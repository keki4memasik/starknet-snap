import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { WalletMock } from '../wallet.mock.test';
import * as utils from '../../src/utils/starknetUtils';
import * as snapUtils from '../../src/utils/snapUtils';
import { createAccount } from '../../src/createAccount';
import { SnapState } from '../../src/types/snapState';
import { STARKNET_MAINNET_NETWORK, STARKNET_TESTNET_NETWORK } from '../../src/utils/constants';
import {
  createAccountProxyTxn,
  createAccountProxyResp,
  createAccountProxyMainnetResp,
  createAccountFailedProxyResp,
  createAccountProxyMainnetResp2,
  getBip44EntropyStub,
  estimateDeployFeeResp,
  getBalanceResp,
  account1,
  account2,
  estimateDeployFeeResp2,
  estimateDeployFeeResp3,
} from '../constants.test';
import { getAddressKeyDeriver } from '../../src/utils/keyPair';
import { Mutex } from 'async-mutex';
import { ApiParams, CreateAccountRequestParams } from '../../src/types/snapApi';

chai.use(sinonChai);
const sandbox = sinon.createSandbox();

describe('Test function: createAccount', function () {
  this.timeout(10000);
  const walletStub = new WalletMock();
  const state: SnapState = {
    accContracts: [],
    erc20Tokens: [],
    networks: [STARKNET_MAINNET_NETWORK, STARKNET_TESTNET_NETWORK],
    transactions: [],
  };
  const apiParams: ApiParams = {
    state,
    requestParams: {},
    wallet: walletStub,
    saveMutex: new Mutex(),
  };

  beforeEach(async function () {
    walletStub.rpcStubs.snap_getBip44Entropy.callsFake(getBip44EntropyStub);
    apiParams.keyDeriver = await getAddressKeyDeriver(walletStub);
    sandbox.useFakeTimers(createAccountProxyTxn.timestamp);
    walletStub.rpcStubs.snap_dialog.resolves(true);
    walletStub.rpcStubs.snap_manageState.resolves(state);
  });

  afterEach(function () {
    walletStub.reset();
    sandbox.restore();
  });

  it('should only return derived address without sending deploy txn correctly in mainnet if deploy is false', async function () {
    sandbox.stub(utils, 'getSigner').throws(new Error());
    const requestObject: CreateAccountRequestParams = {
      chainId: STARKNET_MAINNET_NETWORK.chainId,
    };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    const { publicKey } = await utils.getKeysFromAddressIndex(
      apiParams.keyDeriver,
      STARKNET_MAINNET_NETWORK.chainId,
      state,
      -1,
    );
    const { address: contractAddress } = utils.getAccContractAddressAndCallData(
      STARKNET_MAINNET_NETWORK.accountClassHash,
      publicKey,
    );
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(0);
    expect(result.address).to.be.eq(contractAddress);
    expect(state.accContracts.length).to.be.eq(0);
    expect(state.transactions.length).to.be.eq(0);
  });

  it('should create and store an user account with proxy in state correctly in mainnet', async function () {
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyMainnetResp;
    });
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'callContract').callsFake(async () => {
      return getBalanceResp;
    });
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp;
    });
    const requestObject: CreateAccountRequestParams = {
      chainId: STARKNET_MAINNET_NETWORK.chainId,
      deploy: true,
    };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    const { publicKey: expectedPublicKey } = await utils.getKeysFromAddress(
      apiParams.keyDeriver,
      STARKNET_MAINNET_NETWORK,
      state,
      createAccountProxyMainnetResp.contract_address,
    );
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(4);
    expect(result.address).to.be.eq(createAccountProxyMainnetResp.contract_address);
    expect(result.transaction_hash).to.be.eq(createAccountProxyMainnetResp.transaction_hash);
    expect(state.accContracts.length).to.be.eq(1);
    expect(state.accContracts[0].address).to.be.eq(createAccountProxyMainnetResp.contract_address);
    expect(state.accContracts[0].deployTxnHash).to.be.eq(createAccountProxyMainnetResp.transaction_hash);
    expect(state.accContracts[0].publicKey).to.be.eq(expectedPublicKey);
    expect(state.accContracts[0].addressSalt).to.be.eq(expectedPublicKey);
    expect(state.transactions.length).to.be.eq(1);
  });

  it('should create and store an user account of specific address index with proxy in state correctly in mainnet', async function () {
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyMainnetResp2;
    });
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'callContract').callsFake(async () => {
      return getBalanceResp;
    });
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp;
    });
    const requestObject: CreateAccountRequestParams = {
      chainId: STARKNET_MAINNET_NETWORK.chainId,
      addressIndex: 1,
      deploy: true,
    };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    const { publicKey: expectedPublicKey } = await utils.getKeysFromAddress(
      apiParams.keyDeriver,
      STARKNET_MAINNET_NETWORK,
      state,
      createAccountProxyMainnetResp2.contract_address,
    );
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(4);
    expect(result.address).to.be.eq(createAccountProxyMainnetResp2.contract_address);
    expect(result.transaction_hash).to.be.eq(createAccountProxyMainnetResp2.transaction_hash);
    expect(state.accContracts.length).to.be.eq(2);
    expect(state.accContracts[1].address).to.be.eq(createAccountProxyMainnetResp2.contract_address);
    expect(state.accContracts[1].deployTxnHash).to.be.eq(createAccountProxyMainnetResp2.transaction_hash);
    expect(state.accContracts[1].publicKey).to.be.eq(expectedPublicKey);
    expect(state.accContracts[1].addressSalt).to.be.eq(expectedPublicKey);
    expect(state.transactions.length).to.be.eq(2);
  });

  it('should create and store an user account with proxy in state correctly in testnet in silent mode', async function () {
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyResp;
    });
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'callContract').callsFake(async () => {
      return getBalanceResp;
    });
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp;
    });
    const requestObject: CreateAccountRequestParams = { deploy: true };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams, true);
    const { publicKey: expectedPublicKey } = await utils.getKeysFromAddress(
      apiParams.keyDeriver,
      STARKNET_TESTNET_NETWORK,
      state,
      createAccountProxyResp.contract_address,
    );
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(4);
    expect(result.address).to.be.eq(createAccountProxyResp.contract_address);
    expect(result.transaction_hash).to.be.eq(createAccountProxyResp.transaction_hash);
    expect(state.accContracts.length).to.be.eq(3);
    expect(state.accContracts[2].address).to.be.eq(createAccountProxyResp.contract_address);
    expect(state.accContracts[2].deployTxnHash).to.be.eq(createAccountProxyResp.transaction_hash);
    expect(state.accContracts[2].publicKey).to.be.eq(expectedPublicKey);
    expect(state.accContracts[2].addressSalt).to.be.eq(expectedPublicKey);
    expect(state.transactions.length).to.be.eq(3);
  });

  it('should not create any user account with proxy in state in testnet if not in silentMode and user rejected', async function () {
    walletStub.rpcStubs.snap_dialog.resolves(false);
    const requestObject: CreateAccountRequestParams = { deploy: true };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(0);
    expect(result.address).to.be.eq(account2.address);
    expect(state.accContracts.length).to.be.eq(3);
    expect(state.transactions.length).to.be.eq(3);
  });

  it('should not create any user account with proxy in state in testnet if account already initialized with a signer', async function () {
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyResp;
    });
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    sandbox.stub(utils, 'callContract').callsFake(async () => {
      return getBalanceResp;
    });
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp;
    });
    const requestObject: CreateAccountRequestParams = { deploy: true };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(4);
    expect(result.address).to.be.eq(createAccountProxyResp.contract_address);
    expect(result.transaction_hash).to.be.eq(createAccountProxyResp.transaction_hash);
    expect(state.accContracts.length).to.be.eq(3);
    expect(state.transactions.length).to.be.eq(3);
  });

  it('should not create any user account with proxy in state in testnet if account does not have enough ETH balance', async function () {
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyResp;
    });
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'callContract').callsFake(async () => {
      return getBalanceResp;
    });
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp2;
    });
    const requestObject: CreateAccountRequestParams = { deploy: true };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(3);
    expect(result.address).to.be.eq(createAccountProxyResp.contract_address);
    expect(result.transaction_hash).to.be.eq(createAccountProxyResp.transaction_hash);
    expect(state.accContracts.length).to.be.eq(3);
    expect(state.transactions.length).to.be.eq(3);
  });

  it('should not create any user account with proxy in state in testnet if account does not have enough ETH balance for suggestedMaxFee > 0.000001 ETH', async function () {
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyResp;
    });
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'callContract').callsFake(async () => {
      return getBalanceResp;
    });
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp3;
    });
    const requestObject: CreateAccountRequestParams = { deploy: true };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(3);
    expect(result.address).to.be.eq(createAccountProxyResp.contract_address);
    expect(result.transaction_hash).to.be.eq(createAccountProxyResp.transaction_hash);
    expect(state.accContracts.length).to.be.eq(3);
    expect(state.transactions.length).to.be.eq(3);
  });

  it('should not create any user account with proxy in state in testnet if get account ETH balance throws error', async function () {
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyResp;
    });
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'callContract').throws(new Error());
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp2;
    });
    const requestObject: CreateAccountRequestParams = { deploy: true };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(3);
    expect(result.address).to.be.eq(createAccountProxyResp.contract_address);
    expect(result.transaction_hash).to.be.eq(createAccountProxyResp.transaction_hash);
    expect(state.accContracts.length).to.be.eq(3);
    expect(state.transactions.length).to.be.eq(3);
  });

  it('should skip upsert account and transaction if deployTxn response code has no transaction_hash in testnet', async function () {
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountFailedProxyResp;
    });
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp;
    });
    const requestObject: CreateAccountRequestParams = { deploy: true };
    apiParams.requestParams = requestObject;
    const result = await createAccount(apiParams);
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.callCount(0);
    expect(result.address).to.be.eq(createAccountFailedProxyResp.contract_address);
    expect(result.transaction_hash).to.be.eq(createAccountFailedProxyResp.transaction_hash);
    expect(state.accContracts.length).to.be.eq(3);
    expect(state.transactions.length).to.be.eq(3);
  });

  it('should throw error if upsertAccount failed', async function () {
    sandbox.stub(snapUtils, 'upsertAccount').throws(new Error());
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyResp;
    });
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp;
    });
    const requestObject: CreateAccountRequestParams = { deploy: true };
    apiParams.requestParams = requestObject;

    let result;
    try {
      await createAccount(apiParams);
    } catch (err) {
      result = err;
    } finally {
      expect(result).to.be.an('Error');
    }
  });
});
