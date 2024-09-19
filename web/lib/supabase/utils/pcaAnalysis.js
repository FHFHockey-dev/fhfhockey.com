// lib/supabase/utils/pcaAnalysis.js

const PCA = require("ml-pca"); // Correctly import PCA
console.log("PCA Imported:", PCA); // Should display the PCA class/function
const { mean, stdDev } = require("./statisticalCalculations"); // Ensure correct path

/**
 * Performs PCA on the given data.
 * @param {Array<Array<number>>} data - 2D array where each row is a sample and each column is a feature.
 * @param {number} nComponents - Number of principal components to retain.
 * @returns {object} - Contains principal components and transformed data.
 */
function performPCA(data, nComponents = 2) {
  // Standardize the data (mean=0, variance=1)
  const numFeatures = data[0].length;
  const means = [];
  const stdDevsArr = [];

  for (let i = 0; i < numFeatures; i++) {
    const featureValues = data.map((row) => row[i]);
    const featureMean = mean(featureValues);
    const featureStd = stdDev(featureValues);
    means.push(featureMean);
    stdDevsArr.push(featureStd === 0 ? 1 : featureStd); // Prevent division by zero
  }

  const standardizedData = data.map((row) =>
    row.map((value, index) => (value - means[index]) / stdDevsArr[index])
  );

  // Perform PCA
  const pca = new PCA(standardizedData); // Correctly instantiate PCA
  const transformedData = pca.predict(standardizedData, { nComponents });

  return {
    principalComponents: pca.getEigenvectors(),
    transformedData: transformedData,
  };
}

module.exports = {
  performPCA,
};
