export type Competition = {
    id: number;
    name: string;
    date: string;
    official: boolean;
    is_published: boolean;
};

export type ScrambleRound = { event: string; round: number };

export type CompetitionViewData = {
    name: string;
    date: string;
    num_competitors: number;
    official_link: string | null;
    is_published: boolean;
    events: { name: string; rounds: number }[];
    scramble_rounds?: ScrambleRound[];
};
