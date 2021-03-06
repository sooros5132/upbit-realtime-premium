import { Box, Tooltip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { memo, useEffect, useRef, useState } from 'react';
import isEqual from 'react-fast-compare';
import { IUpbitAccounts } from 'src-server/types/upbit';
import { FlexAlignItemsCenterBox, FlexBox, GridBox, TextAlignRightBox } from '../modules/Box';
import {
  AskBidSpanTypography,
  AskBidTypography,
  HoverUnderLineSpan,
  MonoFontTypography
} from '../modules/Typography';
import { BsDot } from 'react-icons/bs';
import { clientApiUrls } from 'src/utils/clientApiUrls';
import { useExchangeStore } from 'src/store/exchangeSockets';

const AccountsContainer = styled(FlexBox)(({ theme }) => ({
  paddingBottom: theme.spacing(1)
}));

const AccountsInner = styled(FlexAlignItemsCenterBox)(() => ({
  overflowX: 'auto',
  whiteSpace: 'nowrap'
}));

interface IAccountItemProps {
  account: IUpbitAccounts & { currentPrice?: number; totalBalance: number };
}

const AccountItem = memo(({ account }: IAccountItemProps) => {
  const { currentPrice } = account;
  if (typeof currentPrice !== 'number') return null;

  const {
    avg_buy_price,
    // avg_buy_price_modified,
    balance,
    currency,
    locked,
    // unit_currency,
    totalBalance
  } = {
    avg_buy_price: Number(account.avg_buy_price),
    // avg_buy_price_modified: account.avg_buy_price_modified,
    balance: Number(account.balance),
    currency: account.currency,
    locked: Number(account.locked),
    // unit_currency: account.unit_currency,
    totalBalance: account.totalBalance
  };
  const profitAndLoss = Number((-((1 - currentPrice / avg_buy_price) * 100)).toFixed(2));
  const totalPurchaseValue = totalBalance * avg_buy_price;
  const appraisedValue = totalBalance * currentPrice;

  const upbitLink =
    currency !== 'KRW'
      ? `${clientApiUrls.upbit.marketHref + 'KRW-' + currency}`
      : 'https://upbit.com/investments/balance';

  return (
    <>
      <FlexAlignItemsCenterBox>
        <BsDot />
        <a href={upbitLink} rel="noreferrer" target="_blank">
          <HoverUnderLineSpan fontWeight="bold">{currency}</HoverUnderLineSpan>
        </a>
        {currency !== 'KRW' ? (
          <Tooltip
            arrow
            title={
              <GridBox
                sx={{
                  gridTemplateColumns: 'auto 1fr',
                  columnGap: 0.5,
                  rowGap: 0.5,
                  fontSize: (theme) => theme.size.px14
                }}
              >
                <Typography>?????????</Typography>
                <TextAlignRightBox>
                  <MonoFontTypography>{avg_buy_price.toLocaleString()}</MonoFontTypography>
                </TextAlignRightBox>
                <Typography>?????????</Typography>
                <TextAlignRightBox>
                  <MonoFontTypography>{currentPrice.toLocaleString()}</MonoFontTypography>
                </TextAlignRightBox>
                <Typography>????????????</Typography>
                <TextAlignRightBox>
                  <MonoFontTypography>
                    {Math.round(totalPurchaseValue).toLocaleString()}
                  </MonoFontTypography>
                </TextAlignRightBox>
                <Typography>????????????</Typography>
                <TextAlignRightBox>
                  <AskBidSpanTypography state={profitAndLoss}>
                    {Math.round(appraisedValue).toLocaleString()}
                  </AskBidSpanTypography>
                </TextAlignRightBox>
                <Typography>????????????</Typography>
                <TextAlignRightBox>
                  <AskBidSpanTypography state={profitAndLoss}>
                    {Math.round(appraisedValue - totalPurchaseValue).toLocaleString()}
                  </AskBidSpanTypography>
                </TextAlignRightBox>
                <Typography>????????????</Typography>
                <TextAlignRightBox>
                  <MonoFontTypography>{totalBalance.toFixed(8)}</MonoFontTypography>
                </TextAlignRightBox>
              </GridBox>
            }
          >
            <AskBidTypography state={profitAndLoss}>
              &nbsp;
              {`${Math.round(
                currentPrice * totalBalance
              ).toLocaleString()}??? ${profitAndLoss.toFixed(2)}%`}
            </AskBidTypography>
          </Tooltip>
        ) : (
          <Tooltip
            arrow
            title={
              <GridBox
                sx={{
                  gridTemplateColumns: 'auto 1fr',
                  columnGap: 0.5,
                  rowGap: 0.5,
                  fontSize: (theme) => theme.size.px14
                }}
              >
                <Typography>??? ??????</Typography>
                <TextAlignRightBox>
                  <MonoFontTypography>
                    {Math.round(balance + locked).toLocaleString()}
                  </MonoFontTypography>
                </TextAlignRightBox>
                <Typography>?????? ??????</Typography>
                <TextAlignRightBox>
                  <MonoFontTypography>{Math.round(balance).toLocaleString()}</MonoFontTypography>
                </TextAlignRightBox>
              </GridBox>
            }
          >
            <AskBidTypography state={profitAndLoss}>
              &nbsp;
              {`${Math.round(balance + locked).toLocaleString()}???`}
            </AskBidTypography>
          </Tooltip>
        )}
      </FlexAlignItemsCenterBox>
    </>
  );
}, isEqual);

interface IMyAccountsProps {
  upbitAccounts: Array<IUpbitAccounts>;
}

const MyAccounts = memo(({ upbitAccounts: upbitAccountsTemp }: IMyAccountsProps) => {
  const upbitMarketDatasRef = useRef(useExchangeStore.getState().upbitMarketDatas);
  const [num, setNum] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      useExchangeStore.subscribe((state) => {
        upbitMarketDatasRef.current = state.upbitMarketDatas;
      });
      setNum((prev) => 1 - prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  // useEffect(() => {
  //   createPriceUpdateTrigger();
  //   deletePriceUpdateTrigger();
  // });

  const upbitAccounts = upbitAccountsTemp
    .map(
      (account) =>
        ({
          ...account,
          currentPrice:
            account.currency === 'KRW'
              ? 1
              : upbitMarketDatasRef.current['KRW-' + account.currency]?.tp,
          totalBalance: Number(account.balance) + Number(account.locked)
        } as IAccountItemProps['account'])
    )
    .sort((a, b) => {
      if (typeof a.currentPrice !== 'number') {
        return 1;
      } else if (typeof b.currentPrice !== 'number') {
        return -1;
      }
      return b.currentPrice * b.totalBalance - a.currentPrice * a.totalBalance;
    });

  return (
    <AccountsContainer>
      <Tooltip title="KRW ????????? ?????? ????????? ???????????????." arrow>
        <Typography>??????&nbsp;</Typography>
      </Tooltip>
      <AccountsInner
        sx={{
          gridAutoColumns: 'auto',
          columnGap: 1
        }}
      >
        {upbitAccounts.map((account) => (
          <AccountItem key={`header-my-account-${account.currency}`} account={account} />
        ))}
      </AccountsInner>
    </AccountsContainer>
  );
}, isEqual);

MyAccounts.displayName = 'MyAccounts';

AccountItem.displayName = 'AccountItem';

export default MyAccounts;
