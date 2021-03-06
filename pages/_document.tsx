import Document, { DocumentContext, Html, Main, Head, NextScript } from 'next/document';
import { ServerStyleSheets } from '@mui/styles';
// declare class ServerStyleSheets {
//   constructor(options?: object);
//   collect(children: React.ReactNode, options?: object): React.ReactElement<StylesProviderProps>;
//   toString(): string;
//   getStyleElement(props?: object): React.ReactElement;
// }
class CustomDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const materialSheets = new ServerStyleSheets();
    // const materialSheets = new ServerStyleSheets();
    const originalRenderPage = ctx.renderPage;

    try {
      // sheet을 사용해 정의된 모든 스타일을 수집
      ctx.renderPage = () =>
        originalRenderPage({
          enhanceApp: (App) => (props) => materialSheets.collect(<App {...props} />)
        });
      // Documents의 initial props
      const initialProps = await Document.getInitialProps(ctx);
      // props와 styles를 반환
      return {
        ...initialProps,
        styles: (
          <>
            {initialProps.styles}
            {materialSheets.getStyleElement()}
          </>
        )
      };
    } catch (error) {
      throw error;
    }
  }
  render() {
    return (
      <Html lang="ko">
        <Head>
          <meta charSet="utf-8" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;1,100;1,200;1,300;1,400;1,500;1,600;1,700&display=swap"
            rel="stylesheet"
          />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default CustomDocument;
