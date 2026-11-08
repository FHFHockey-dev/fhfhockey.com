/**
 * The Discord line-combo capture element: the matrix grid inside the team's section. The grid sits inside a
 * scroll viewport, so it is a descendant of the section, not a direct child.
 */
export function linemateMatrixCaptureSelector(teamId: number): string {
  return `#linemate-matrix-${teamId} .content`;
}
