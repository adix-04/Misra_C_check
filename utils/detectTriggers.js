const keywordTriggers = {
    goto: "goto",
    for: "for",
    while: "while",
    switch: "switch",
    if: "if"
};

function detectTriggers(text) {
    const triggers = new Set();

    for (const keyword in keywordTriggers) {
        if (text.includes(keyword)) {
            console.log(text);
            triggers.add(keywordTriggers[keyword]);
        }
    }

    return triggers;
}

module.exports = detectTriggers;