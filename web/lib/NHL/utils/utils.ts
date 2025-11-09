// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-1\web\lib\NHL\utils.ts

export const mapTeamAbbreviation = (abbrev: string): string => {
  const aliasMap: { [key: string]: string } = {
    ARI: "UTA" // Map ARI to UTA
    // Add other aliases if necessary
  };

  return aliasMap[abbrev] || abbrev;
};
