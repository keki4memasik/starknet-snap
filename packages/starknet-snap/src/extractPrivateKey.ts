import { validateAndParseAddress } from 'starknet';
import { ApiParams, ExtractPrivateKeyRequestParams } from './types/snapApi';
import { getNetworkFromChainId } from './utils/snapUtils';
import { getKeysFromAddress } from './utils/starknetUtils';
import { DialogType } from '@metamask/rpc-methods';
import { copyable, panel, text } from '@metamask/snaps-ui';

export async function extractPrivateKey(params: ApiParams) {
  try {
    const { state, wallet, keyDeriver, requestParams } = params;
    const requestParamsObj = requestParams as ExtractPrivateKeyRequestParams;
    const useOldAccounts = !!requestParamsObj.useOldAccounts;

    if (!requestParamsObj.userAddress) {
      throw new Error(
        `The given user address need to be non-empty string, got: ${JSON.stringify(requestParamsObj.userAddress)}`,
      );
    }

    try {
      validateAndParseAddress(requestParamsObj.userAddress);
    } catch (err) {
      throw new Error(`The given user address is invalid: ${requestParamsObj.userAddress}`);
    }

    const response = await wallet.request({
      method: 'snap_dialog',
      params: {
        type: DialogType.Confirmation,
        content: panel([text('Do you want to export your private Key ?')]),
      },
    });

    if (response === true) {
      const userAddress = requestParamsObj.userAddress;
      const network = getNetworkFromChainId(state, requestParamsObj.chainId, useOldAccounts);
      const { privateKey: userPrivateKey } = await getKeysFromAddress(keyDeriver, network, state, userAddress);

      await wallet.request({
        method: 'snap_dialog',
        params: {
          type: DialogType.Alert,
          content: panel([text('StarkNet Account Private Key'), copyable(userPrivateKey)]),
        },
      });
    }

    return null;
  } catch (err) {
    console.error(`Problem found: ${err}`);
    throw err;
  }
}
