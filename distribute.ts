import { TezosToolkit } from '@taquito/taquito'
import { InMemorySigner } from '@taquito/signer';
import * as fs from 'fs';
import util from 'util';
import {load} from 'ts-dotenv';

const env = load({
    AIRDROP_PRIVATE_KEY: String,
    DISTRIBUTION_FILE: String,
    NODE_URL: String,
    TOKEN_CONTRACT: String,
    TOKEN_NAME: String,
    TOKEN_ID: Number,
});

const distributionFile = 'airdrop.csv'
const nodeUrl = 'https://mainnet-tezos.giganode.io'
const privateKey = 'Your-Private-Key-That-Owns-Token-Contract-EDSK'
const contractAddress = 'Your-Token-Contract-KT1-Address'
const tokenName = 'Your-Token-Name-Here'
// FOR FA2 TOKENS ONLY
const tokenId = 0 
// Delay between operation injections
const TIME_DELAY = 10;
// chunk drops into batches
const batch_size = 50

type AirDrop = {
  address: string,
  amount: string
}

type CompletedAirDrop = {
  address: string,
  amount: string,
  operationHash: string
}

const main = async () => {
  // Load a signer
  const tezos = new TezosToolkit(nodeUrl);
  const signer = new InMemorySigner(privateKey)
  tezos.setProvider({
    signer
  });

  const drops: Array<AirDrop> = []
  fs.readFileSync(distributionFile, 'utf-8').split(/\r?\n/).forEach(function (line) {
    const split = line.split(',')
    const trimmed = split.map((input) => {
      return input.trim()
    })
    drops.push({
      address: trimmed[0],
      amount: trimmed[1],
    })
  })

  // Iterate over each airdop and carry out the drop.
  const completedOps: Array<CompletedAirDrop> = []

try {
    // Get contract
    const tokenContract = await tezos.contract.at(contractAddress)
    
    while(drops.length > 0) {
      const batch = tezos.contract.batch()
      var dropsBatch = drops.splice(0, batch_size)
      console.log(`>> Creating new batch ${dropsBatch}`)

      for(let i = 0; i < dropsBatch.length; i++){
        console.log(`>> Sending ${dropsBatch[i].amount} to ${dropsBatch[i].address}`)
        batch.withContractCall(
          await tokenContract.methods.transfer([{ 
            from_: await signer.publicKeyHash(), 
            txs: [{ to_: dropsBatch[i].address, token_id: 0, amount: dropsBatch[i].amount, }]
          }]))
      }
    // send
    const result = await batch.send()
    console.log(`>> Sent in hash ${result.hash}. Waiting for 1 confirmation.`)
    await result.confirmation(1)
    console.log(`>> Confirmed.`)
    console.log(``)
    //await util.sleep(TIME_DELAY)

    for(let i = 0; i < dropsBatch.length; i++){
      const drop = dropsBatch[i]
      completedOps.push({
        address: drop.address,
        amount: drop.amount,
        operationHash: result.hash
      }) 
    }

    }
  } catch (e) {
    console.log(`Error: ${e}`)
  }

  // Print results to file
  console.log("> Writing results.")
  const dropFile = "completed_airdrops.csv"
  if (fs.existsSync(dropFile)) {
    fs.unlinkSync(dropFile)
  }
  fs.writeFileSync(dropFile, `address, amount (mutez), operation hash,\n`)
  for (let i = 0; i < completedOps.length; i++) {
    const completedOp = completedOps[i]

    fs.appendFileSync(dropFile, `${completedOp.address}, ${completedOp.amount}, ${completedOp.operationHash},\n`)
  }
  console.log(`> Written to ${dropFile}`)
  console.log("")
}

main()