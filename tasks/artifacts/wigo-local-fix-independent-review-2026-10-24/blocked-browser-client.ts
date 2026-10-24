const unavailable = () => { throw new Error("Reviewer forbids a real browser/auth transport"); };
export const createClientWithToken = unavailable;
export default { from: unavailable, auth: { getUser: unavailable } };
