import { Connector, Chain, ConnectorData, SwitchChainError } from 'wagmi';
import type {
  EthereumProviderConfig as BloctoOptions,
  EthereumProviderInterface as BloctoProvider,
} from '@blocto/sdk';
import BloctoSDK from '@blocto/sdk';
import { providers } from 'ethers';
import { ConnectorNotFoundError } from 'wagmi';
import { hexValue } from 'ethers/lib/utils.js';

type BloctoWalletSigner = providers.JsonRpcSigner;

class BloctoConnector extends Connector<
  BloctoProvider,
  BloctoOptions,
  BloctoWalletSigner
> {
  readonly id = 'bloctoWallet';
  readonly name = 'Blocto Wallet';
  readonly ready = true;

  #provider?: BloctoProvider;

  constructor(config: { chains?: Chain[]; options: BloctoOptions }) {
    super(config);
  }

  getProvider() {
    if (!this.#provider) {
      this.#provider = new BloctoSDK({ ethereum: this.options })?.ethereum;
    }

    if (!this.#provider) {
      throw new ConnectorNotFoundError();
    }

    return Promise.resolve(this.#provider);
  }

  async connect(
    config?: { chainId?: number | undefined } | undefined
  ): Promise<Required<ConnectorData<BloctoProvider>>> {
    const provider = await this.getProvider();
    await provider?.enable();
    const account = await this.getAccount();
    const id = await this.getChainId();
    const unsupported = this.isChainUnsupported(id);

    return {
      account,
      chain: { id, unsupported },
      provider,
    };
  }

  async disconnect(): Promise<void> {
    const provider = await this.getProvider();
    await provider?.request({ method: 'wallet_disconnect' });
  }

  async getAccount(): Promise<`0x${string}`> {
    const provider = await this.getProvider();

    return provider
      .request({ method: 'eth_requestAccounts' })
      .then(
        (accounts: string[]): `0x${string}` => accounts[0] as `0x${string}`
      );
  }

  async getChainId(): Promise<number> {
    const provider = await this.getProvider();

    return provider
      .request({ method: 'eth_chainId' })
      .then((chainId: string): number => parseInt(chainId));
  }

  async getSigner(
    config?: { chainId?: number | undefined } | undefined
  ): Promise<BloctoWalletSigner> {
    const provider = await this.getProvider();
    const account = await this.getAccount();

    return new providers.Web3Provider(provider).getSigner(account);
  }

  async isAuthorized(): Promise<boolean> {
    const account = await this.getAccount();
    return Promise.resolve(!!account);
  }
  async switchChain(chainId: number): Promise<Chain> {
    const provider = await this.getProvider();
    const id = hexValue(chainId);
    const chain = this.chains.find((x) => x.id === chainId);

    try {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          { chainId: id, rpcUrls: [chain?.rpcUrls.infura?.http[0] ?? ''] },
        ],
      });

      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: id }],
      });

      return (
        chain ?? {
          id: chainId,
          name: `Chain ${id}`,
          network: `${id}`,
          nativeCurrency: { name: 'Ether', decimals: 18, symbol: 'ETH' },
          rpcUrls: { default: { http: [''] }, public: { http: [''] } },
        }
      );
    } catch (error) {
      throw new SwitchChainError(error);
    }
  }

  protected onAccountsChanged(accounts: `0x${string}`[]): void {
    // not supported yet
  }
  protected onChainChanged(chain: string | number): void {
    // not supported yet
  }
  protected onDisconnect(error: Error): void {
    // not supported yet
  }
}

export default BloctoConnector;
