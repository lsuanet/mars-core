import {
  isTxError,
  LCDClient,
  LocalTerra, MnemonicKey,
  MsgExecuteContract,
  MsgInstantiateContract,
  MsgStoreCode
} from '@terra-money/terra.js';
import {readFileSync} from 'fs';

async function perform_transaction(wallet, msg) {
  const tx = await wallet.createAndSignTx({msgs: [msg]});
  const result = await terra.tx.broadcast(tx);
  if (isTxError(result)) {
    throw new Error(
      `transaction failed. code: ${result.code}, codespace: ${result.codespace}, raw_log: ${result.raw_log}`
    );
  }
  return result
}

async function upload_contract(wallet, filepath) {
  const contract = readFileSync(filepath, 'base64');
  const upload_msg = new MsgStoreCode(wallet.key.accAddress, contract);
  let result = await perform_transaction(wallet, upload_msg);
  return Number(result.logs[0].events[1].attributes[1].value) //code_id
}

async function instantiate_contract(wallet, code_id, msg) {
  const instantiate_msg = new MsgInstantiateContract(wallet.key.accAddress, code_id, msg);
  let result = await perform_transaction(wallet, instantiate_msg)
  return result.logs[0].events[0].attributes[2].value //contract address
}

async function execute_contract(wallet, contract_address, msg) {
  const execute_msg = new MsgExecuteContract(wallet.key.accAddress, contract_address, msg);
  return await perform_transaction(wallet, execute_msg);
}

async function query_contract(contract_address, query) {
  return await terra.wasm.contractQuery(
    contract_address,
    query
  )
}

async function deploy() {
  const lp_code_id = await upload_contract(test1, '../artifacts/liquidity_pool.wasm');
  const ma_code_id = await upload_contract(test1, '../artifacts/ma_token.wasm');
  console.log("LP Code ID: " + lp_code_id);
  console.log("MA Code ID: " + ma_code_id);
  const lp_init_msg = {"ma_token_contract_id": ma_code_id};
  const lp_contract_address = await instantiate_contract(test1, lp_code_id, lp_init_msg);
  console.log("LP contract_address: " + lp_contract_address);
  const lp_execute_msg = {"init_asset": {"symbol": "luna"}};
  return await execute_contract(test1, lp_contract_address, lp_execute_msg);
}

async function test_deploy() {
  const code_id = await upload_contract(test1, './my_first_contract.wasm');
  const contract_address = await instantiate_contract(test1, code_id, {"count": 0});
  return await execute_contract(test1, contract_address, {"increment": {}});
}

const terra = new LocalTerra();
const test1 = terra.wallets.test1;
deploy().then(res => console.log("deployed", res));
