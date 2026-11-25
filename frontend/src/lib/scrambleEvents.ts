// Competition events use display names, while cubing.js uses event codes.
const eventIds: Record<string, string> = {
    "222": "222", "2x2": "222", "2x2x2": "222",
    "333": "333", "3x3": "333", "3x3x3": "333",
    "444": "444", "4x4": "444", "4x4x4": "444",
    "555": "555", "5x5": "555", "5x5x5": "555",
    "666": "666", "6x6": "666", "6x6x6": "666",
    "777": "777", "7x7": "777", "7x7x7": "777",
    "333oh": "333oh", "oh": "333oh", "3x3oh": "333oh", "3x3onehanded": "333oh",
    "333bf": "333bf", "bld": "333bf", "3bld": "333bf", "3x3bld": "333bf", "3x3blindfolded": "333bf",
    "444bf": "444bf", "4bld": "444bf", "4x4bld": "444bf", "4x4blindfolded": "444bf",
    "555bf": "555bf", "5bld": "555bf", "5x5bld": "555bf", "5x5blindfolded": "555bf",
    "333fm": "333fm", "fmc": "333fm", "fewestmoves": "333fm",
    "333mbf": "333mbf", "mbld": "333mbf", "3x3mbld": "333mbf", "3x3multiblind": "333mbf",
    "clock": "clock", "minx": "minx", "megaminx": "minx",
    "pyram": "pyram", "pyraminx": "pyram",
    "skewb": "skewb", "sq1": "sq1", "square1": "sq1", "fto": "fto",
};

export function scrambleEventCode(event: string) {
    const key = event.toLowerCase().replaceAll("×", "x").replace(/[^a-z0-9]/g, "");
    return Object.hasOwn(eventIds, key) ? eventIds[key] : undefined;
}
