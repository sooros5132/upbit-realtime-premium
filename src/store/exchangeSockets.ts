import create, { GetState } from 'zustand';
import { NamedSet } from 'zustand/middleware';
import { IMarketTableItem } from 'src/components/market-table/MarketTable';
import { IUpbitForex, IUpbitMarket, IUpbitSocketMessageTickerSimple } from 'src/types/upbit';
import { clientApiUrls } from 'src/utils/clientApiUrls';
import { v4 as uuidv4 } from 'uuid';
import { keyBy, sortBy } from 'lodash';
import { IBinanceSocketMessageTicker } from 'src/types/binance';
import { krwRegex } from 'src/utils/regex';
import { useMarketTableSettingStore } from './marketTableSetting';

interface IExchangeState {
  sortedUpbitMarketSymbolList: Array<string>;
  upbitForex?: IUpbitForex;
  upbitMarkets: Array<IUpbitMarket>;
  searchedSymbols: Array<string>;
  upbitMarketDatas: Record<string, IMarketTableItem>;
  binanceMarkets: Array<IUpbitMarket>;
  binanceMarketDatas: Record<string, IBinanceSocketMessageTicker>;
  upbitSocket?: WebSocket;
  binanceSocket?: WebSocket;
  lastUpdatedAt: Date;
}

interface IConnectSocketProps {}

interface IConnectUpbitSocketProps extends IConnectSocketProps {
  upbitMarkets: Array<IUpbitMarket>;
}

interface IConnectBinanceSocketProps extends IConnectSocketProps {
  binanceMarkets: Array<String>;
}

const defaultState: IExchangeState = {
  upbitForex: undefined,
  sortedUpbitMarketSymbolList: [],
  upbitMarkets: [],
  searchedSymbols: [],
  upbitMarketDatas: {},
  binanceMarkets: [],
  binanceMarketDatas: {},
  upbitSocket: undefined,
  binanceSocket: undefined,
  lastUpdatedAt: new Date()
};

interface IExchangeStore extends IExchangeState {
  setUpbitMarkets: (markets: IExchangeState['upbitMarkets']) => void;
  setUpbitMarketDatas: (marketDatas: IExchangeState['upbitMarketDatas']) => void;
  setBinanceMarkets: (markets: IExchangeState['binanceMarkets']) => void;
  setBinanceMarketDatas: (marketDatas: IExchangeState['binanceMarketDatas']) => void;
  distroyAll: () => void;
  connectUpbitSocket: (props: IConnectUpbitSocketProps) => void;
  disconnectUpbitSocket: () => void;
  connectBinanceSocket: (props: IConnectBinanceSocketProps) => void;
  disconnectBinanceSocket: () => void;
  searchSymbols: (searchValue: string) => void;
  sortSymbolList: (sortColumn: keyof IMarketTableItem, sortType: 'ASC' | 'DESC') => void;
}

const handleConnectUpbitSocket =
  (set: NamedSet<IExchangeStore>, get: GetState<IExchangeStore>) =>
  ({ upbitMarkets }: IConnectUpbitSocketProps) => {
    //? ?????? ?????? ??????
    const ticket = uuidv4(); // * ????????? ?????? ????????? ???.
    const type = 'ticker'; // * ????????? -> ticker, ?????? -> trade, ?????? ->orderbook
    const krwSymbols = upbitMarkets.map((c) => c.market); // * ????????? ?????????

    const format = 'SIMPLE'; // socket ???????????? ?????????
    const isOnlySnapshot = true; // socket ?????? ???????????? ??????
    const isOnlyRealtime = true; // socket ????????? ????????? ??????
    //? ?????? ?????? ??????

    const markets = keyBy(upbitMarkets, 'market'); // market?????? ?????? ???????????? ????????? ?????? ??????.

    let unapplied = 0;
    const dataBuffer: IExchangeState['upbitMarketDatas'] = get().upbitMarketDatas || {};
    // set({ upbitMarketDatas: socketDatas });

    setInterval(() => {
      if (unapplied !== 0) {
        unapplied = 0;
        set({
          upbitMarketDatas: dataBuffer
        });
      }
    }, 200);

    const handleMessage = async (e: WebSocketEventMap['message']) => {
      const message = JSON.parse(await e.data.text()) as IUpbitSocketMessageTickerSimple;

      unapplied++;

      const { upbitForex, binanceMarketDatas } = get();
      const binanceMarketSymbol = message.cd.replace(krwRegex, '') + 'USDT';
      const binanceMarket = binanceMarketDatas[binanceMarketSymbol];

      if (!upbitForex || !binanceMarket) {
        dataBuffer[message.cd] = { ...dataBuffer[message.cd], ...message };
      } else {
        const binanceKrwPrice = binanceMarket
          ? Number(binanceMarket.data.c) * upbitForex.basePrice
          : undefined;
        const premium = binanceKrwPrice ? (1 - binanceKrwPrice / message.tp) * 100 : undefined;

        dataBuffer[message.cd] = {
          ...dataBuffer[message.cd],
          ...message,
          binance_price: binanceMarket.data.c,
          binance_volume: binanceMarket.data.q,
          premium: premium
        };
      }
    };

    function wsConnect() {
      {
        const upbitSocket = get().upbitSocket;
        if (upbitSocket && upbitSocket.readyState !== 1) {
          upbitSocket.close();
        }
      }
      let ws: WebSocket = new WebSocket(clientApiUrls.upbit.websocket);
      set({ upbitSocket: ws });

      ws.binaryType = 'blob';
      ws.addEventListener('open', () => {
        ws.send(
          JSON.stringify([{ ticket }, { type, codes: krwSymbols, isOnlyRealtime }, { format }])
        );
      });

      ws.addEventListener('message', handleMessage);

      ws.addEventListener('error', (err: WebSocketEventMap['error']) => {
        // console.error('Socket encountered error: ', err, 'Closing socket');
      });
      ws.addEventListener('close', (e: WebSocketEventMap['close']) => {
        // console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
        setTimeout(() => {
          const { upbitSocket } = get();
          if (!upbitSocket || upbitSocket.readyState !== 1) {
            wsConnect();
          }
        }, 1000);
      });
    }

    if (!get().upbitSocket) {
      wsConnect();
    }
  };

const handleConnectBinanceSocket =
  (set: NamedSet<IExchangeStore>, get: GetState<IExchangeStore>) =>
  ({ binanceMarkets }: IConnectBinanceSocketProps) => {
    const dataBuffer: IExchangeState['binanceMarketDatas'] = get().binanceMarketDatas || {};
    let unapplied = 0;

    setInterval(() => {
      if (unapplied !== 0) {
        unapplied = 0;
        set({
          binanceMarketDatas: dataBuffer
        });
      }
    }, 100);

    const handleMessage = async (e: WebSocketEventMap['message']) => {
      const message = JSON.parse(e.data) as IBinanceSocketMessageTicker;
      if (!message?.data?.s) {
        return;
      }
      unapplied++;
      dataBuffer[message.data.s] = message;
    };

    function wsConnect() {
      {
        const socket = get().binanceSocket;
        if (socket && socket.readyState !== 1) {
          socket.close();
        }
      }
      let ws: WebSocket = new WebSocket(clientApiUrls.binance.websocket);
      set({ binanceSocket: ws });

      ws.binaryType = 'blob';
      ws.addEventListener('open', () => {
        if (ws)
          ws.send(
            JSON.stringify({
              method: 'SUBSCRIBE',
              params: binanceMarkets,
              id: 1
            })
          );
      });

      ws.addEventListener('message', handleMessage);

      ws.addEventListener('error', (err: WebSocketEventMap['error']) => {
        // console.error('Socket encountered error: ', err, 'Closing socket');
      });
      ws.addEventListener('close', (e: WebSocketEventMap['close']) => {
        // console.log('Socket is closed. Reconnect will be attempted in 1 second.', e.reason);
        setTimeout(() => {
          const { binanceSocket } = get();

          if (!binanceSocket || binanceSocket.readyState !== 1) {
            wsConnect();
          }
        }, 1000);
      });
    }

    if (!get().binanceSocket) {
      wsConnect();
    }
  };

const useExchangeStore = create<IExchangeStore>(
  // persist(
  // devtools(
  (set, get) => ({
    ...defaultState,
    setUpbitMarkets(markets) {
      set({ upbitMarkets: [...markets] });
    },
    setUpbitMarketDatas(marketDatas) {
      set({ upbitMarketDatas: { ...marketDatas } });
    },
    setBinanceMarkets(markets) {
      set({ binanceMarkets: [...markets] });
    },
    setBinanceMarketDatas(marketDatas) {
      set({ binanceMarketDatas: { ...marketDatas } });
    },
    connectUpbitSocket: handleConnectUpbitSocket(set, get),
    disconnectUpbitSocket() {
      const socket = get().upbitSocket;
      if (socket) {
        if (socket.readyState === 1) socket.close();
        set({ upbitSocket: undefined });
      }
    },
    connectBinanceSocket: handleConnectBinanceSocket(set, get),
    disconnectBinanceSocket() {
      const socket = get().binanceSocket;
      if (socket) {
        if (socket.readyState === 1) socket.close();
        set({ binanceSocket: undefined });
      }
    },
    searchSymbols(searchValue: string) {
      const { upbitMarkets } = get();
      if (searchValue) {
        const filterdMarketSymbols = upbitMarkets
          .filter((m) => {
            // KRW ?????? ??????
            if (krwRegex.test(m.market)) {
              // korean, eng, symbol ?????? ??????
              return Boolean(
                Object.values(m).filter((value: string) =>
                  value.toLocaleUpperCase().match(searchValue.toLocaleUpperCase())
                ).length
              );
            }
          })
          .map((market) => market.market);

        set({
          searchedSymbols: filterdMarketSymbols
        });
      } else {
        set({
          searchedSymbols: upbitMarkets.filter((m) => krwRegex.test(m.market)).map((m) => m.market)
        });
      }
    },
    sortSymbolList(sortColumn, sortType) {
      const upbitForex = get().upbitForex;
      if (!upbitForex) return;
      set((state) => {
        const favoriteSymbols = useMarketTableSettingStore.getState().favoriteSymbols;
        const { searchedSymbols, upbitMarketDatas } = state;
        const favoriteList: IMarketTableItem[] = [];
        const normalList = searchedSymbols
          .map((symbol) => upbitMarketDatas[symbol])
          .filter((m) => {
            const favorite = favoriteSymbols[m.cd];
            if (favorite) {
              favoriteList.push(m);
            } else {
              return true;
            }
          });

        // const mergeMarkets = upbitMarketDatas.map((upbitMarket) => {
        //   return {
        //     ...upbitMarket
        //   };
        // });

        // const handleSort = (aItem: IMarketTableItem, bItem: IMarketTableItem) => {
        //   const a = aItem[sortColumn];
        //   const b = bItem[sortColumn];
        //   if (a === undefined) return 1;
        //   if (b === undefined) return -1;

        //   if (typeof a === 'number' && typeof b === 'number') {
        //     if (sortType === 'ASC') {
        //       return a - b;
        //     }
        //     return b - a;
        //   } else if (typeof a === 'string' && typeof b === 'string') {
        //     const aValue = a.toUpperCase();
        //     const bValue = b.toUpperCase();
        //     if (sortType === 'ASC') {
        //       if (aValue < bValue) {
        //         return 1;
        //       }
        //       if (aValue > bValue) {
        //         return -1;
        //       }
        //       return 0;
        //     }
        //     if (aValue < bValue) {
        //       return -1;
        //     }
        //     if (aValue > bValue) {
        //       return 1;
        //     }
        //     return 0;
        //   }
        //   return 0;
        // };

        const sortedFavoriteList =
          sortType === 'ASC'
            ? sortBy(favoriteList, sortColumn)
            : sortBy(favoriteList, sortColumn).reverse();
        const sortedNormalList =
          sortType === 'ASC'
            ? sortBy(normalList, sortColumn)
            : sortBy(normalList, sortColumn).reverse();

        const sortedSymbolList = sortedFavoriteList.concat(sortedNormalList).map((m) => {
          upbitMarketDatas[m.cd] = m;
          return m.cd;
        });

        return {
          searchedSymbols: sortedSymbolList
        };
      });
    },
    distroyAll() {
      set({ ...defaultState });
    }
  })
  // )
  // ),
  //   {
  //     name: 'upbitData', // unique name
  //     getStorage: () => localStorage // (optional) by default, 'localStorage' is used
  //   }
);

export type { IExchangeState };
export { useExchangeStore };
