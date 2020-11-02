package main

import (
	"context"
	"crypto/ecdsa"
	"crypto/ed25519"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"github.com/fxamacker/cbor/v2"
	"github.com/joho/godotenv"
	"io/ioutil"
	"log"
	"math"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/ellipticoin/go-ec-client"
	eth_crypto "github.com/ethereum/go-ethereum/crypto"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

var decimals map[common.Address]uint
var lastBlockNumber uint64
var infuraNetwork string
var privateKey ed25519.PrivateKey
var ethPrivateKey *ecdsa.PrivateKey
var ethBridgeAddress common.Address
var wethAddress common.Address
var bridge2 abi.ABI
var infuraProjectId string
var client *ethclient.Client
var ec *ecclient.Client
var mintTopic common.Hash

const confirmationsRequired = 1

type Contract struct {
	ABI []interface{} `json:"abi"`
}

func check(e error) {
	if e != nil {
		panic(e)
	}
}

func getDecimals(token common.Address) uint {
	if decimals[token] == 0 {
		return 18
	} else {
		return decimals[token]
	}
}

func init() {
	var err error
	mintTopic = common.HexToHash("0x103a2d32aec953695f3b9ec5ed6c1c6cb822debe92cf1fcf0832cb2c262c7eec")
	renBTCAddress := common.HexToAddress("0xeb4c2781e4eba804ce9a9803c67d0893436bb27d")

	decimals = make(map[common.Address]uint)
	decimals[renBTCAddress] = 8

	godotenv.Load()
	infuraProjectId = os.Getenv("INFURA_PROJECT_ID")
	infuraNetwork = os.Getenv("INFURA_NETWORK")
	wethAddress = common.HexToAddress(os.Getenv("WETH_ADDRESS"))
	ethPrivateKey, err = crypto.HexToECDSA(os.Getenv("ETH_PRIVATE_KEY"))
	ethBridgeAddress = common.HexToAddress(os.Getenv("ETH_BRIDGE_ADDRESS"))
	ethPublicKey := ethPrivateKey.Public()
	publicKeyECDSA, ok := ethPublicKey.(*ecdsa.PublicKey)
	if !ok {
		panic("cannot assert type: publicKey is not of type *ecdsa.PublicKey")
	}

	fmt.Printf("Starting with address: 0x%s\n", hex.EncodeToString(crypto.PubkeyToAddress(*publicKeyECDSA).Bytes()))
	privateKey, err = base64.StdEncoding.DecodeString(os.Getenv("PRIVATE_KEY"))
	ec = ecclient.NewClient(privateKey)
	client, err = ethclient.Dial(fmt.Sprintf("wss://%s.infura.io/ws/v3/%s", infuraNetwork, infuraProjectId))
	bridgeJSON, err := ioutil.ReadFile("./artifacts/contracts/Bridge.sol/Bridge.json")
	check(err)
	var contract Contract
	json.Unmarshal(bridgeJSON, &contract)

	abiBytes, err := json.Marshal(contract.ABI)
	check(err)
	bridge2, err = abi.JSON(strings.NewReader(string(abiBytes)))
	check(err)
	blockNumber, err := client.BlockNumber(context.Background())
	lastBlockNumber = blockNumber - confirmationsRequired
	check(err)
}

func main() {
	go watchEth()
	port := os.Getenv("PORT")

	if port == "" {
		log.Fatal("$PORT must be set")
	}
	http.HandleFunc("/", BridgeServer)
	http.ListenAndServe(":"+port, nil)
}

func signRelease(
	token common.Address,
	recipient common.Address,
	amount *big.Int,
	foreignTransactionId uint32,
	contractAddress common.Address) []byte {
	hash := releaseMessageHash(
		token,
		recipient,
		amount,
		foreignTransactionId,
		contractAddress,
	)
	signature, err := eth_crypto.Sign(hash.Bytes(), ethPrivateKey)
	check(err)
	// See: https://github.com/ethereum/EIPs/blob/master/EIPS/eip-155.md
	signature[64] = signature[64] + 27
	return signature

}
func releaseMessageHash(
	token common.Address,
	recipient common.Address,
	amount *big.Int,
	foreignTransactionId uint32,
	contractAddress common.Address) common.Hash {
	foreignTransactionIdBytes := make([]byte, 4)
	binary.BigEndian.PutUint32(foreignTransactionIdBytes, foreignTransactionId)
	return eth_crypto.Keccak256Hash(
		token.Bytes(),
		recipient.Bytes(),
		common.LeftPadBytes(amount.Bytes(), common.HashLength),
		foreignTransactionIdBytes,
		contractAddress.Bytes(),
	)
}

func BridgeServer(w http.ResponseWriter, r *http.Request) {
	enableCors(&w)
	transactionIdString, ok := r.URL.Query()["transaction_id"]
	if !ok || len(transactionIdString[0]) < 1 {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	transactionId, err := strconv.Atoi(transactionIdString[0])
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	transaction := ec.GetTransaction(uint32(transactionId))
	okValueBytes, err := cbor.Marshal(map[string]interface{}{"Ok": nil})
	check(err)
	if base64.StdEncoding.EncodeToString(okValueBytes) != string(transaction.ReturnValue) {
		w.WriteHeader(http.StatusBadRequest)
		return
	}
	argumentsBytes, err := base64.StdEncoding.DecodeString(string(transaction.Arguments))
	check(err)
	var arguments []interface{}
	err = cbor.Unmarshal(argumentsBytes, &arguments)
	check(err)
	token := common.BytesToAddress(arguments[0].([]byte))
	recipient := common.BytesToAddress(arguments[1].([]byte))
	amount := scaleUp(int64(arguments[2].(uint64)), token)
	signature := signRelease(
		token,
		recipient,
		&amount,
		uint32(transactionId),
		ethBridgeAddress,
	)
	check(err)
	w.Header().Set("Content-Type", "application/cbor")
	w.WriteHeader(http.StatusOK)
	w.Write(signature)
	log.Printf("Released %f 0x%s to %s\n", float64(amount.Int64())/math.Pow10(int(getDecimals(token))), hex.EncodeToString(token.Bytes()), base64.StdEncoding.EncodeToString(recipient.Bytes()))
}
func enableCors(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "*")
}

func watchEth() {
	headers := make(chan *types.Header)
	sub, err := client.SubscribeNewHead(context.Background(), headers)
	check(err)
	for {
		select {
		case err := <-sub.Err():
			panic(err)
		case header := <-headers:
			if header.Number.Uint64()-confirmationsRequired < lastBlockNumber {
				continue
			}
			log.Printf("Processing ETH block %d through %d\n", lastBlockNumber, header.Number.Uint64()-confirmationsRequired)
			processBlocks(lastBlockNumber, header.Number.Uint64()-confirmationsRequired)
			lastBlockNumber = header.Number.Uint64() + 1 - confirmationsRequired
		}
	}
}

func processBlocks(fromBlock uint64, toBlock uint64) {
	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(fromBlock)),
		ToBlock:   big.NewInt(int64(toBlock)),
		Topics: [][]common.Hash{{
			mintTopic,
		}},
	}
	ethLogs, err := client.FilterLogs(context.Background(), query)
	check(err)
	mint := struct {
		Token              uint8
		EllipticoinAddress [32]byte
		Amount             *big.Int
	}{}
	for _, ethLog := range ethLogs {
		err := bridge2.UnpackIntoInterface(&mint, "Mint", ethLog.Data)
		token := common.BytesToAddress(ethLog.Topics[1+mint.Token].Bytes()[12:])
		check(err)
		amount := scaleDown(mint.Amount, token)
		var sender [32]uint
		for i := range privateKey.Public().(ed25519.PublicKey) {
			sender[i] = uint(privateKey.Public().(ed25519.PublicKey)[i])
		}
		transaction := ecclient.TransactionRequest{
			Contract: "Bridge",
			Sender:   sender,
			Function: "mint",
			Arguments: []interface{}{
				token.Bytes(),
				mint.EllipticoinAddress[:],
				amount,
			},
		}
		err = ec.PostTransaction(transaction)
		check(err)
		log.Printf("Minted %f 0x%s to %s\n", float64(amount)/1000000.0, hex.EncodeToString(ethLog.Topics[1+mint.Token].Bytes()[12:]), base64.StdEncoding.EncodeToString(mint.EllipticoinAddress[:]))
	}
}

func scaleDown(n *big.Int, token common.Address) uint64 {
	decimals := getDecimals(token)
	scale := big.NewInt(int64(decimals - 6))
	var i big.Int
	var amount big.Int
	i.Exp(big.NewInt(10), scale, nil)
	amount.Div(n, &i)

	return amount.Uint64()

}

func scaleUp(n int64, token common.Address) big.Int {
	decimals := getDecimals(token)
	scale := decimals - 6
	var i big.Int
	var amount big.Int
	i.Exp(big.NewInt(10), big.NewInt(int64(scale)), nil)
	amount.Mul(big.NewInt(n), &i)

	return amount

}
