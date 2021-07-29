import 'dotenv/config.js'
import {
  deployContract,
  executeContract,
  instantiateContract,
  queryContract,
  recover,
  setTimeoutDuration,
  setupRedBank,
  uploadContract,
} from "./helpers.js"
import { LCDClient, LocalTerra, Wallet } from "@terra-money/terra.js"
import { join } from "path"
import chalk from "chalk";
import dotenv from "dotenv";
import yargs from "yargs/yargs";

//----------------------------------------------------------------------------------------
// Parse Input Parameters
//----------------------------------------------------------------------------------------

// Parse .env
dotenv.config();

// Parse options
const argv = yargs(process.argv)
  .options({
    network: {
      alias: "n",
      type: "string",
      demandOption: true,
    }
  })
  .parseSync();

  // LCD Client
  let terra; 
  if (!["columbus", "bombay"].includes(argv.network)) {
    console.log(chalk.red("Error!"), "Invalid network: must be 'columbus' or 'bombay'");
    process.exit(0);
  } else {
    terra =
      argv.network == 
      "columbus" ? new LCDClient({ URL: "https://lcd.terra.dev", chainID: "columbus-5" })
       : 
      new LCDClient({ URL: "https://bombay-lcd.terra.dev", chainID: "bombay-0008" });
  
    console.log(`\nNetwork  : ${chalk.cyan(argv.network)}`);
  }

  // WALLET FOR DEPLOYING
  let deployer;
  if (!process.env.MNEMONIC) {
    console.log(chalk.red("Error!"), "MNEMONIC not provided");
    process.exit(0);
  } else {
    deployer = terra.wallet( new MnemonicKey({mnemonic: process.env.MNEMONIC}) );
    console.log(`Deployer : ${chalk.cyan(deployer.key.accAddress)}\n`);
  }
  

  // SEND CW20 TOKENS MSG
  export async function send_CW20Tokens_VIA_IBC( terra, wallet, token_address, ibc_router_address, amount, channel, remote_address, timeout ) {
    let hookmsg =  { "channel": channel , "remote_address": remote_address ,"timeout": timeout } ;
    let ibc_transfer_msg = { "send": { "contract": ibc_router_address, 
                                "amount": amount,
                                "msg": toBase64(transfer_msg),
                            }
                  };
    ibc_transfer_msgExec = new MsgExecuteContract(wallet.key.accAddress, token_address, ibc_transfer_msg);
    tx = await wallet.createAndSignTx({ msgs: [ibc_transfer_msgExec], fee: new StdFee(30000000, [ new Coin('uluna', 4500000),new Coin('uusd', 4500000)]), });
    result = await terra.tx.broadcast(tx);
    console.log(result);

  }