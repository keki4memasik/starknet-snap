import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { WalletMock } from '../wallet.mock.test';
import * as utils from '../../src/utils/starknetUtils';
import * as snapUtils from '../../src/utils/snapUtils';
import { SnapState } from '../../src/types/snapState';
import { sendTransaction } from '../../src/sendTransaction';
import { STARKNET_TESTNET_NETWORK, STARKNET_TESTNET_NETWORK_DEPRECATED } from '../../src/utils/constants';
import {
  account1,
  createAccountProxyResp,
  estimateDeployFeeResp,
  estimateFeeResp,
  getBalanceResp,
  getBip44EntropyStub,
  sendTransactionFailedResp,
  sendTransactionResp,
  token2,
  token3,
  unfoundUserAddress,
} from '../constants.test';
import { getAddressKeyDeriver } from '../../src/utils/keyPair';
import { Mutex } from 'async-mutex';
import { ApiParams, SendTransactionRequestParams } from '../../src/types/snapApi';

chai.use(sinonChai);
const sandbox = sinon.createSandbox();

describe('Test function: sendTransaction', function () {
  this.timeout(5000);
  const walletStub = new WalletMock();
  const state: SnapState = {
    accContracts: [account1],
    erc20Tokens: [token2, token3],
    networks: [STARKNET_TESTNET_NETWORK, STARKNET_TESTNET_NETWORK_DEPRECATED],
    transactions: [],
  };
  const apiParams: ApiParams = {
    state,
    requestParams: {},
    wallet: walletStub,
    saveMutex: new Mutex(),
  };
  let executeTxnResp;

  beforeEach(async function () {
    walletStub.rpcStubs.snap_getBip44Entropy.callsFake(getBip44EntropyStub);
    apiParams.keyDeriver = await getAddressKeyDeriver(walletStub);
    sandbox.stub(utils, 'estimateFeeBulk').callsFake(async () => {
      return [estimateFeeResp];
    });
    sandbox.stub(utils, 'estimateFee').callsFake(async () => {
      return estimateFeeResp;
    });
    sandbox.stub(utils, 'estimateFee_v4_6_0').callsFake(async () => {
      return estimateFeeResp;
    });
    executeTxnResp = sendTransactionResp;
    sandbox.stub(utils, 'executeTxn').callsFake(async () => {
      return executeTxnResp;
    });
    sandbox.stub(utils, 'executeTxn_v4_6_0').callsFake(async () => {
      return executeTxnResp;
    });
    walletStub.rpcStubs.snap_dialog.resolves(true);
    walletStub.rpcStubs.snap_manageState.resolves(state);
  });

  afterEach(function () {
    walletStub.reset();
    sandbox.restore();
  });

  it('should send a transaction for transferring 10 tokens correctly', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: account1.address,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.called;
    expect(result).to.be.eql(sendTransactionResp);
  });

  it('should trigger a deploy txn and send a transaction for transferring 10 tokens correctly', async function () {
    sandbox.stub(utils, 'getSigner').throws(new Error());
    sandbox.stub(utils, 'deployAccount').callsFake(async () => {
      return createAccountProxyResp;
    });
    sandbox.stub(utils, 'callContract').callsFake(async () => {
      return getBalanceResp;
    });
    sandbox.stub(utils, 'estimateAccountDeployFee').callsFake(async () => {
      return estimateDeployFeeResp;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: account1.address,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.called;
    expect(result).to.be.eql(sendTransactionResp);
  });

  it('should send a transaction for transferring 10 tokens correctly for an old account', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: account1.address,
      useOldAccounts: true,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.called;
    expect(result).to.be.eql(sendTransactionResp);
  });

  it('should return false if user rejected to sign the transaction', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    walletStub.rpcStubs.snap_dialog.resolves(false);
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: account1.address,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).not.to.have.been.called;
    expect(result).to.be.eql(false);
  });

  it('should send a transaction for transferring 10 tokens but not update snap state if transaction_hash is missing from response', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    executeTxnResp = sendTransactionFailedResp;
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: account1.address,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).not.to.have.been.called;
    expect(result).to.be.eql(sendTransactionFailedResp);
  });

  it('should send a transaction with given max fee for transferring 10 tokens correctly', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: account1.address,
      maxFee: '15135825227039',
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.called;
    expect(result).to.be.eql(sendTransactionResp);
  });

  it('should send a transfer transaction for empty call data', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: undefined,
      senderAddress: account1.address,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.called;
    expect(result).to.be.eql(sendTransactionResp);
  });

  it('should send a transaction for empty call data', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: account1.address,
      contractFuncName: 'get_signer',
      contractCallData: undefined,
      senderAddress: account1.address,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.called;
    expect(result).to.be.eql(sendTransactionResp);
  });

  it('should send a transaction for transferring 10 tokens from an unfound user correctly', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: unfoundUserAddress,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.called;
    expect(result).to.be.eql(sendTransactionResp);
  });

  it('should send a transaction for transferring 10 tokens (token of 10 decimal places) from an unfound user correctly', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x06a09ccb1caaecf3d9683efe335a667b2169a409d19c589ba1eb771cd210af75',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: unfoundUserAddress,
    };
    apiParams.requestParams = requestObject;
    const result = await sendTransaction(apiParams);
    expect(walletStub.rpcStubs.snap_dialog).to.have.been.calledOnce;
    expect(walletStub.rpcStubs.snap_manageState).to.have.been.called;
    expect(result).to.be.eql(sendTransactionResp);
  });

  it('should throw error if upsertTransaction failed', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    sandbox.stub(snapUtils, 'upsertTransaction').throws(new Error());
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: unfoundUserAddress,
    };
    apiParams.requestParams = requestObject;

    let result;
    try {
      await sendTransaction(apiParams);
    } catch (err) {
      result = err;
    } finally {
      expect(result).to.be.an('Error');
    }
  });

  it('should throw an error if contract address is undefined', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: undefined,
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: unfoundUserAddress,
    };
    apiParams.requestParams = requestObject;
    let result;
    try {
      result = await sendTransaction(apiParams);
    } catch (err) {
      result = err;
    } finally {
      expect(result).to.be.an('Error');
    }
  });

  it('should throw an error if function name is undefined', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: undefined,
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: unfoundUserAddress,
    };
    apiParams.requestParams = requestObject;
    let result;
    try {
      result = await sendTransaction(apiParams);
    } catch (err) {
      result = err;
    } finally {
      expect(result).to.be.an('Error');
    }
  });

  it('should throw an error if sender address is undefined', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: undefined,
    };
    apiParams.requestParams = requestObject;
    let result;
    try {
      result = await sendTransaction(apiParams);
    } catch (err) {
      result = err;
    } finally {
      expect(result).to.be.an('Error');
    }
  });

  it('should throw an error if contract address is invalid', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: 'wrongAddress',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: account1.address,
    };
    apiParams.requestParams = requestObject;
    let result;
    try {
      result = await sendTransaction(apiParams);
    } catch (err) {
      result = err;
    } finally {
      expect(result).to.be.an('Error');
    }
  });

  it('should throw an error if sender address is invalid', async function () {
    sandbox.stub(utils, 'getSigner').callsFake(async () => {
      return account1.publicKey;
    });
    const requestObject: SendTransactionRequestParams = {
      contractAddress: '0x07394cbe418daa16e42b87ba67372d4ab4a5df0b05c6e554d158458ce245bc10',
      contractFuncName: 'transfer',
      contractCallData: '0x0256d8f49882cc9366037415f48fa9fd2b5b7344ded7573ebfcef7c90e3e6b75,100000000000000000000,0',
      senderAddress: 'wrongAddress',
    };
    apiParams.requestParams = requestObject;
    let result;
    try {
      result = await sendTransaction(apiParams);
    } catch (err) {
      result = err;
    } finally {
      expect(result).to.be.an('Error');
    }
  });
});
