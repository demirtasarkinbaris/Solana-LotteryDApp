import Header from "../components/Header";
import PotCard from "../components/PotCard";
import Table from "../components/Table";
import style from "../styles/Home.module.css";

import { useMemo } from "react";
import {
	ConnectionProvider,
	WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
require("@solana/wallet-adapter-react-ui/styles.css");
import { AppProvider } from "../context/context";

export default function Home() {
	const endpoint =
		"https://hardworking-sparkling-reel.solana-devnet.discover.quiknode.pro/38559f024f3e8f62287e4a809901e7f75d64ec69/";
	const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

	return (
		<ConnectionProvider endpoint={endpoint}>
			<WalletProvider wallets={wallets} autoConnect>
				<WalletModalProvider>
					<AppProvider>
						<div className={style.wrapper}>
							<Header />
							<PotCard />
							<Table />
						</div>
					</AppProvider>
				</WalletModalProvider>
			</WalletProvider>
		</ConnectionProvider>
	);
}
