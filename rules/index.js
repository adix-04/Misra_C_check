// module.exports = [

//     require("./Rule15_1"),
//     require("./Rule8_4"),
//     require("./Rule2_2"),
//     require("./Rule2_6"),
//     require("./Rule3_2"),
//     require("./Rule8_2"),
//     require("./Rule9_2")

// ];
const Rule15_1 = require("./Rule15_1");
//const Rule10_1 = require("./Rule10_1"); // was in earlier messages, missing here too
const Rule2_2  = require("./Rule2_2");
const Rule2_6  = require("./Rule2_6");
const Rule3_2  = require("./Rule3_2");
const Rule8_2  = require("./Rule8_2");
const Rule8_4  = require("./Rule8_4");
//const Rule9_2  = require("./Rule9_2");

const allRules = [
    Rule15_1,
   // Rule10_1,
    Rule2_2,
    Rule2_6,
    Rule3_2,
    Rule8_2,
    Rule8_4,
    //Rule9_2
];

for (const rule of allRules) {
    if (rule.scope !== "line" && rule.scope !== "document") {
        console.warn(`[misra] rule "${rule.id}" has no valid scope set — it will not run`);
    }
}

module.exports = {
    lineRules: allRules.filter(r => r.scope === "line"),
    documentRules: allRules.filter(r => r.scope === "document")
};