// lib/supabase/utils/testPCA.js

const { performPCA } = require("./pcaAnalysis");

// Sample Data: Each row is a sample, each column is a feature
const sampleData = [
  [2.5, 2.4],
  [0.5, 0.7],
  [2.2, 2.9],
  [1.9, 2.2],
  [3.1, 3.0],
  [2.3, 2.7],
  [2, 1.6],
  [1, 1.1],
  [1.5, 1.6],
  [1.1, 0.9],
];

const pcaResult = performPCA(sampleData, 2);
console.log("Principal Components:", pcaResult.principalComponents);
console.log("Transformed Data:", pcaResult.transformedData);
