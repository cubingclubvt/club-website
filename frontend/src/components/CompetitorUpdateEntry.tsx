import React, { FC } from 'react';


interface Competitor {
    "first_name": string;
    "last_name": string;
    school_id: string;
    "grade": number;
}


/**
 * Props interface for CompetitorUpdateEntry Component.
 * Defines the types for the props that CompetitorUpdateEntry expects.
 */
interface CompetitorUpdateEntryProps {
    solves: string[];
    competitor: Competitor;
    solveCount: number;
    change_handler: (school_id: string, solveNumber: number, solve: string) => void;
    delete_handler: (competitor: Competitor) => void;
}

/**
 * CompetitorUpdateEntry Component
 * Renders a single section for a competitor, including their name
 * and a dynamic number of horizontal input fields.
 *
 * @param {object} props - The component props.
 * @param {string} props.competitorName - The name of the competitor to display.
 * @param {number} props.solveCount - The number of horizontal input fields to generate for this competitor.
 */
const CompetitorUpdateEntry: FC<CompetitorUpdateEntryProps> = ({ solves, competitor, solveCount, change_handler, delete_handler }) => {
    // Create an array of numbers from 1 to solveCount to map over for the input fields.
    const solveEntries = Array.from({ length: solveCount }, (_, i) => i + 1);

    return (
        // Outer container for a single competitor's section
        // w-full: takes full width of its parent
        // bg-slate-800: dark background
        // rounded-md: slightly rounded corners
        // p-4: padding all around
        // mb-5: margin-bottom for spacing between competitor sections
        <div className={"w-full bg-slate-800 rounded-md p-4 mb-5"}>

            <div className={"flex justify-center items-center gap-3 mb-4"}>
                {/* Competitor Name Display */}
                {/* text-white: white text color
                    text-xl: large text size */}
                <div className={"text-white text-xl"}>
                    {`${competitor.first_name} ${competitor.last_name} (${competitor.school_id})`}
                </div>

                {/* Delete Button - Now part of the flex container next to the name */}
                <button
                    onClick={() => delete_handler(competitor)}
                    className="bg-red-400 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-sm text-md hover:cursor-pointer"
                    aria-label={`Delete entry for ${competitor.first_name} ${competitor.last_name}`}
                >
                    &times; {/* HTML entity for a multiplication sign / 'x' */}
                </button>
            </div>


            {/* Inner Flexbox Container for Horizontal Input Fields */}
            {/* w-full: takes full width of its parent
          flex: enables flexbox
          justify-between: distributes items with space between them (first at start, last at end)
          items-center: vertically centers items in the cross-axis (if heights vary)
          gap-6: provides a consistent 24px gap between the child input divs */}
            <div className={"w-full flex justify-between items-center gap-6"}>
                {solveEntries.map((solveNum) => (
                    // Individual div for each input field
                    // key: essential for React list rendering performance and stability
                    // flex-1: makes this flex item grow and shrink equally to fill available space
                    <div key={solveNum} className="flex-1">
                        {/* "Solve X" Label */}
                        {/* block: ensures it takes its own line
                text-center: centers the text
                text-slate-300: light gray text color */}
                        <div className={"block text-center text-slate-300"}>
                            Solve {solveNum} {/* Dynamically display "Solve 1", "Solve 2", etc. */}
                        </div>
                        {/* Input Field */}
                        {/* type="number": restricts input to numbers
                name: unique name for form submission/state management (includes competitor name and solve number)
                value: controlled component value (empty for now, but would be managed by state in a real app)
                onChange: event handler (empty for now, but would update state in a real app)
                className: Tailwind classes for styling the input
                    text-center: centers text inside the input
                    block: ensures it takes its own line
                    w-full: takes full width of its parent (which is the flex-1 div)
                    mx-auto: centers the input horizontally within its parent (though w-full makes this less visible)
                    p-2: padding
                    my-2: vertical margin
                    bg-white: white background
                    border-4: 4px border
                    border-slate-400: gray border
                    rounded-lg: rounded corners */}
                        <input
                            type="text"
                            name={`solve-${competitor.school_id}-${solveNum}`} // Unique name for each input
                            value={solves[solveNum - 1]}
                            onChange={e => change_handler(competitor.school_id, solveNum, e.target.value)}
                            className={`text-black text-center block w-full mx-auto p-2 my-2 bg-white border-4 border-slate-400 rounded-lg`}
                            placeholder=""
                            autoComplete="off"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CompetitorUpdateEntry;
