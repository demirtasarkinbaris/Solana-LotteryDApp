import { createContext, useContext, useMemo, useEffect, useState } from "react";
import { BN } from "@project-serum/anchor";
import { SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { bs58 } from "@project-serum/anchor/dist/cjs/utils/bytes";

import {
	getLotteryAddress,
	getMasterAddress,
	getProgram,
	getTicketAddress,
	getTotalPrize,
} from "../utils/program";
import { confirmTx, mockWallet } from "../utils/helper";

import { toast } from "react-hot-toast";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
	const [masterAddress, setMasterAddress] = useState();
	const [initialized, setInitialized] = useState(false);
	const [lotteryId, setLotteryId] = useState();
	const [lotteryPot, setLotteryPot] = useState();
	const [lottery, setLottery] = useState();
	const [lotteryAddress, setLotteryAddress] = useState();
	const [userWinningId, setUserWinningId] = useState();
	const [lotteryHistory, setLotteryHistory] = useState([]);

	const { connection } = useConnection();
	const wallet = useAnchorWallet();
	const program = useMemo(() => {
		if (connection) {
			return getProgram(connection, wallet ?? mockWallet());
		}
	}, [connection, wallet]);

	useEffect(() => {
		updateState();
	}, [program]);

	useEffect(() => {
		if (!lottery) return;
		getPot();
		getHistory();
	}, [lottery]);

	const updateState = async () => {
		if (!program) return;

		try {
			if (!masterAddress) {
				const masterAddress = await getMasterAddress();
				setMasterAddress(masterAddress);
			}
			const master = await program.account.master.fetch(
				masterAddress ?? (await getMasterAddress())
			);

			setInitialized(true);
			setLotteryId(master.lastId);

			const lotteryAddress = await getLotteryAddress(master.lastId);
			setLotteryAddress(lotteryAddress);
			const lottery = await program.account.lottery.fetch(lotteryAddress);
			setLottery(lottery);

			if (!wallet.publicKey) return;
			const userTickets = await program.account.ticket.all();

			const userWin = userTickets.some(
				(t) => t.account.id === lottery.winnerId
			);

			if (userWin) {
				setUserWinningId(lottery.winnerId);
			} else {
				setUserWinningId(null);
			}
		} catch (error) {
			console.log(error);
		}
	};

	const getPot = async () => {
		const pot = getTotalPrize(lottery);
		setLotteryPot(pot);
	};

	const initMaster = async () => {
		try {
			const txHash = await program.methods
				.initMaster()
				.accounts({
					master: masterAddress,
					payer: wallet.publicKey,
					systemProgram: SystemProgram.programId,
				})
				.rpc();

			await confirmTx(txHash, connection);

			updateState();
			toast.success("initialized master");
		} catch (error) {
			console.log(error);
			toast.error(error);
		}
	};

	const createLottery = async () => {
		try {
			const lotteryAddress = await getLotteryAddress(lotteryId + 1);
			const txHash = await program.methods
				.createLottery(new BN(1).mul(new BN(LAMPORTS_PER_SOL)))
				.accounts({
					lottery: lotteryAddress,
					master: masterAddress,
					authority: wallet.publicKey,
					systemProgram: SystemProgram.programId,
				})
				.rpc();

			await confirmTx(txHash, connection);
			updateState();
			toast.success("lottery created");
		} catch (error) {
			console.log(error);
			toast.error(error);
		}
	};

	const buyTicket = async () => {
		try {
			const txHash = await program.methods
				.buyTicket(lotteryId)
				.accounts({
					lottery: lotteryAddress,
					ticket: await getTicketAddress(
						lotteryAddress,
						lottery.lastTicketId + 1
					),
					buyer: wallet.publicKey,
					systemProgram: SystemProgram.programId,
				})
				.rpc();

			await confirmTx(txHash, connection);
			updateState();
			toast.success("buyed ticket");
		} catch (error) {
			console.log(error);
			toast.error(error);
		}
	};

	const pickWinner = async () => {
		try {
			const txHash = await program.methods
				.pickWinner(lotteryId)
				.accounts({
					lottery: lotteryAddress,
					authority: wallet.publicKey,
				})
				.rpc();

			await confirmTx(txHash, connection);
			updateState();
			toast.success("picked winner");
		} catch (error) {
			console.log(error);
			toast.error(error);
		}
	};

	const getHistory = async () => {
		if (!lotteryId) return;

		const history = [];

		for (const i in new Array(lotteryId).fill(null)) {
			const id = lotteryId - parseInt(i);
			if (!id) break;

			const lotteryAddress = await getLotteryAddress(id);
			const lottery = await program.account.lottery.fetch(lotteryAddress);

			const winnerId = lottery.winnerId;
			if (!winnerId) continue;

			const ticketAddress = await getTicketAddress(lotteryAddress, winnerId);
			const ticket = await program.account.ticket.fetch(ticketAddress);

			history.push({
				lotteryId: id,
				winnerId,
				winnerAddress: ticket.authority,
				prize: getTotalPrize(lottery),
			});
		}

		setLotteryHistory(history);
	};

	const claimPrize = async () => {
		try {
			const txHash = await program.methods
				.claimPrize(lotteryId, userWinningId)
				.accounts({
					lottery: lotteryAddress,
					ticket: await getTicketAddress(lotteryAddress, userWinningId),
					authority: wallet.publicKey,
					systemProgram: SystemProgram.programId,
				})
				.rpc();

			await confirmTx(txHash, connection);
			updateState();
			toast.success("claim success");
		} catch (error) {
			console.log(error);
			toast.error(error);
		}
	};

	return (
		<AppContext.Provider
			value={{
				// Put functions/variables you want to bring out of context to App in here
				connected: wallet?.publicKey ? true : false,
				isMasterInitialized: initialized,
				lotteryId,
				initMaster,
				createLottery,
				lotteryPot,
				buyTicket,
				isLotteryAuthority:
					wallet && lottery && wallet.publicKey.equals(lottery.authority),
				pickWinner,
				isFinished: lottery && lottery.winnerId,
				canClaim: lottery && !lottery.claimed && userWinningId,
				lotteryHistory,
				claimPrize,
			}}>
			{children}
		</AppContext.Provider>
	);
};

export const useAppContext = () => {
	return useContext(AppContext);
};
