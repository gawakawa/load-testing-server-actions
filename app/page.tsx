import { revalidatePath } from 'next/cache';

// ponytail: in-memory counter for exercising the Server Action under load.
// Resets on restart/HMR and isn't shared across processes — swap for a DB
// row if a load test needs counts to survive restarts or span workers.
let actionCount = 0;

export default function Home() {
	const increment = async () => {
		'use server';
		actionCount += 1;
		revalidatePath('/');
	};

	return (
		<div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
			<main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center gap-2 py-32 px-16 bg-white dark:bg-black">
				<p className="text-sm text-zinc-600 dark:text-zinc-400">
					Server Action calls: <strong>{actionCount}</strong>
				</p>
				<form action={increment}>
					<button
						type="submit"
						className="rounded-full border border-solid border-black/[.08] px-4 py-2 text-sm font-medium transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
					>
						Call Server Action
					</button>
				</form>
			</main>
		</div>
	);
}
