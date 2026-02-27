import { Competition } from "@/types/Competition";
import CompetitionCard from "@/components/CompetitionCard";
import { apiFetch } from "@/lib/api";

async function Competitions() {
  let competitions: Competition[] = [];

  if (process.env.DISABLE_BACKEND === "false") {
    try {
      competitions = await apiFetch(`/competitions`);
    } catch (error) {
      console.error("Failed to fetch competition data:", error);
      competitions = []; // fallback to empty array on failure
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-5 items-center max-w-4xl w-full mx-auto my-28">
        <h2 className="text-white text-5xl">Competitions</h2>
        <div className="flex flex-col justify-center items-center w-full gap-5 p-5 m-5">
          {competitions.length > 0 ? (
            competitions.map((competition) => (
              <CompetitionCard key={competition.id} competition={competition} />
            ))
          ) : (
            <div className="text-center text-gray-300 bg-gray-800/50 px-6 py-10 rounded-2xl shadow-md">
              <h3 className="text-2xl font-semibold mb-2">Previous competitions will be added soon</h3>
              <p className="text-gray-400">And stay tuned for future competitions throughout the 2025-26 school year!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Competitions;
