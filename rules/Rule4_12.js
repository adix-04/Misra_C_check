const { createDiagnostic } = require("../utils/helper");

// MISRA C:2012 Directive 4.12
// Dynamic memory allocation shall not be used.
//
// Standard C dynamic memory management functions.
// free() is included because the Directive's amplification
// applies to allocation/deallocation routines.
const dynamicMemoryFunctions = new Set([
    "malloc",
    "calloc",
    "realloc",
    "free"
]);

// Matches an identifier followed by '('.
// Examples:
//   malloc(
//   malloc (
//   my_alloc(
// Does not match:
//   my_malloc_function_name
const functionCall = /\b([a-zA-Z_]\w*)\s*\(/g;

module.exports = {
    id: "Dir-4.12",
    scope: "line",
    title: "Dynamic memory allocation shall not be used",

    checkLine(line, lineNumber) {
        const diagnostics = [];
        let match;

        functionCall.lastIndex = 0;

        while ((match = functionCall.exec(line)) !== null) {
            const functionName = match[1];

            if (!dynamicMemoryFunctions.has(functionName)) {
                continue;
            }

            const startIndex = match.index;
            const endIndex = match.index + match[0].length;

            diagnostics.push(
                createDiagnostic(
                    lineNumber,
                    startIndex,
                    endIndex,
                    "Dir-4.12",
                    `Dynamic memory allocation function '${functionName}' shall not be used`
                )
            );
        }

        return diagnostics;
    }
};