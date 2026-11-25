export type Competition = {
    id: number;
    name: string;
    date: string;
    official: boolean;
    is_published: boolean;
};

export type ScrambleRound = { event: string; round: number };
