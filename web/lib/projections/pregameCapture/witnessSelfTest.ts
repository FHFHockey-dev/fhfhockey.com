import { createHash } from "node:crypto";
import { decodePacket, encodePacket, PACKET_VERSION, type PregamePacket } from "./packet";
import { extractToken, verifyTimeStampToken, type TsaTrust } from "./rfc3161";

/**
 * Known-answer self-test for the witness runtime (run by the Edge Function before it judges any game). If the runtime's
 * X.509/RSA verification, gzip, canonical JSON or Ed25519 differed from Node's, a genuine claim would be signed as
 * token_invalid or packet_invalid forever; this refuses to judge instead. Inputs are public: DigiCert's real probe
 * response from 2026-11-15T02:37:45Z (random digest, no FHFH data; also in __fixtures__/tsa) and a synthetic packet.
 */
const DIGICERT_PROBE_TSR = [
  "MIIXdDADAgEAMIIXawYJKoZIhvcNAQcCoIIXXDCCF1gCAQMxDzANBglghkgBZQMEAgEFADCBgwYLKoZIhvcNAQkQAQSgdARyMHACAQEGCWCGSAGG/WwHATAx",
  "MA0GCWCGSAFlAwQCAQUABCDxpGC5d/ROwOiTa/0gvyeg6eozo5Td71mDL4/JvL9dUwIRAPLXJlI/GTWq3h8J+fweCjcYDzIwMjYxMTE1MDIzNzQ1WgIJANEP",
  "++J7uvsnoIITOjCCBu0wggTVoAMCAQICEAhP3DNPfkVO28MPj/mSGDUwDQYJKoZIhvcNAQELBQAwaTELMAkGA1UEBhMCVVMxFzAVBgNVBAoTDkRpZ2lDZXJ0",
  "LCBJbmMuMUEwPwYDVQQDEzhEaWdpQ2VydCBUcnVzdGVkIEc0IFRpbWVTdGFtcGluZyBSU0E0MDk2IFNIQTI1NiAyMDI1IENBMTAeFw0yNjA4MDUwMDAwMDBa",
  "Fw0zNzExMDQyMzU5NTlaMGMxCzAJBgNVBAYTAlVTMRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5jLjE7MDkGA1UEAxMyRGlnaUNlcnQgU0hBMjU2IFJTQTQwOTYg",
  "VGltZXN0YW1wIFJlc3BvbmRlciAyMDI2IDEwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC2e6byyf7NSvjUm0xls/04xjD4fAkOkbnGQi7+Wpx8",
  "1iYxfzViaxSIctuH3KSl5YEYpMuFgGsA31N2D9ATMbfZdw5uaAhuWevQKhDdZIB4NnqcfpfpWQXJiQnDdAElETC+bhSEvNLGbA8DtwUpFMQ4yyYQSPqomT92",
  "osQAv6hBi47ATZS6JfVWe6XxhF4jJZ3iSAuf2Cros1czRSmWRHqMv9AfGZvp8ygYElhudpQjtcPpwoOl6QrZJUyV3iINvN4cO05prGV0fkjG426xDr2d3z9l",
  "cSIHkdvGPdGUrXdxfVbgOUVcp2/8ISEzwKPW++Wa+E2ujI91EZtukGWDJ/xZ27k3oHKEXBRGfRTqjOU+jE3ba/5++JSE/7oNHnjs5mekExYN96LV/mxUbCKJ",
  "b8pBNY4r3uD7hEmk/M81XhVgwDA7aMzYC3LZBg9WY5BMmbSay5ecmtJuXaB/0nKWmQmVZeqTVDgsmzHP5MQuhAJkiWNuC9MmCg9TZHXbJ2/yLVSov9p16UDT",
  "LtT0+aa1vN71fHeu1qMLlLNB3WOB/ADCxr3S/1hxI92Z6jKgEED/btwIvbfuXkNNhg8MtDg43c4tMZae9FvqMOt/9PvmAxF9TNIsIFB8G6yb36ZJZGUL8N/p",
  "L971DyLXcK6HM5PYnH5X+eVtczhCgHCVQCF6XDAlPQIDAQABo4IBlTCCAZEwDAYDVR0TAQH/BAIwADAdBgNVHQ4EFgQUFMljijAu1Er7bpTz5uNAfvXszeIw",
  "HwYDVR0jBBgwFoAU729TSunkBnx6yuKQVvYv1Ensy04wDgYDVR0PAQH/BAQDAgeAMBYGA1UdJQEB/wQMMAoGCCsGAQUFBwMIMIGVBggrBgEFBQcBAQSBiDCB",
  "hTAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQuY29tMF0GCCsGAQUFBzAChlFodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGlnaUNlcnRU",
  "cnVzdGVkRzRUaW1lU3RhbXBpbmdSU0E0MDk2U0hBMjU2MjAyNUNBMS5jcnQwXwYDVR0fBFgwVjBUoFKgUIZOaHR0cDovL2NybDMuZGlnaWNlcnQuY29tL0Rp",
  "Z2lDZXJ0VHJ1c3RlZEc0VGltZVN0YW1waW5nUlNBNDA5NlNIQTI1NjIwMjVDQTEuY3JsMCAGA1UdIAQZMBcwCAYGZ4EMAQQCMAsGCWCGSAGG/WwHATANBgkq",
  "hkiG9w0BAQsFAAOCAgEAjcU6YR6dUgrfmawJgH59KECxa9Ji8sEi2g10CBDaMiqsaxWyW5cwlT/6ZF5sFznazqVsoC85U9dqLOYqQwst+UQQoNlDHgKRLa3x",
  "oc+OReFreFhnTXSG0Vrd2E2CZqUfm+5a+He1MJ/h+tNLuA+0Zzhn/Fo+FDYAHWZHx4R79ZsfRFYe9UiXpXBDf6DkUo183Y38NYmR/XfDYf7YZ+oR9t3flbDw",
  "K+hgGMs0gNNp1w9Z2CyOyI5or/sSwomAuNQ0hWC9xoU4stD8aWsD7RkcmgVRs6vlIk3zPKQ+ylcheWkMlj+CoVRlFE55pv0ZWCaFt04lwP/rdGHE9qEVQZty",
  "RE42ox7oNgC/r+Y4bSlZ3dw9K2x1xLtu6PkPKeLBFjzKigwfqm3Hm+k/+lnME8F5kPZTgiy2HLEHklpryqs6QHnPXrRNeIzkAMyylnRN8P0wmirS0WkU+ywp",
  "EWFZ4QNg+9xS43tTuW9x0eXh7NDc1P/sV+zWxHXKH8tFt1ncHdVzqrZaYPyYMLSn2TOXajveJW1L3joiQSPsWRGxkbDDW15jERFE4LvjnGu2O9zD1nLJSMdl",
  "YZEikl4w2w+q4IN/R+TIe0H4ngCI1moJCTbevGH4punIxM1Uoi0nmX3ZK+XbRT01uowE5ViXWHng0RgsmrX/EdYUo80r3TfMlkD0/YMwgga0MIIEnKADAgEC",
  "AhANx6xXBf8hmS5AQyIMOkmGMA0GCSqGSIb3DQEBCwUAMGIxCzAJBgNVBAYTAlVTMRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdp",
  "Y2VydC5jb20xITAfBgNVBAMTGERpZ2lDZXJ0IFRydXN0ZWQgUm9vdCBHNDAeFw0yNTA1MDcwMDAwMDBaFw0zODAxMTQyMzU5NTlaMGkxCzAJBgNVBAYTAlVT",
  "MRcwFQYDVQQKEw5EaWdpQ2VydCwgSW5jLjFBMD8GA1UEAxM4RGlnaUNlcnQgVHJ1c3RlZCBHNCBUaW1lU3RhbXBpbmcgUlNBNDA5NiBTSEEyNTYgMjAyNSBD",
  "QTEwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC0eDHTCphBcr48RsAcrHXbo0ZodLRRF51NrY0NlLWZloMsVO1DahGPNRcybEKq+RuwOnPhof6p",
  "vF4uGjwjqNjfEvUi6wuim5bap+0lgloM2zX4kftn5B1IpYzTqpyFQ/4Bt0mAxAHeHYNnQxqXmRinvuNgxVBdJkf77S2uPoCj7GH8BLuxBG5AvftBdsOECS1U",
  "kxBvMgEdgkFiDNYiOTx4OtiFcMSkqTtF2hfQz3zQSku2Ws3IfDReb6e3mmdglTcaarps0wjUjsZvkgFkriK9tUKJm/s80FiocSk1VYLZlDwFt+cVFBURJg6z",
  "MUjZa/zbCclF83bRVFLeGkuAhHiGPMvSGmhgaTzVyhYn4p0+8y9oHRaQT/aofEnS5xLrfxnGpTXiUOeSLsJygoLPp66bkDX1ZlAeSpQl92QOMeRxykvq6gby",
  "lsXQskBBBnGy3tW/AMOMCZIVNSaz7BX8VtYGqLt9MmeOreGPRdtBx3yGOP+rx3rKWDEJlIqLXvJWnY0v5ydPpOjL6s36czwzsucuoKs7Yk/ehb//Wx+5kMqI",
  "MRvUBDx6z1ev+7psNOdgJMoiwOrUG2ZdSoQbU2rMkpLiQ6bGRinZbI4OLu9BMIFm1UUl9VnePs6BaaeEWvjJSjNm2qA+sdFUeEY0qVjPKOWug/G6X5uAiynM",
  "7Bu2ayBjUwIDAQABo4IBXTCCAVkwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU729TSunkBnx6yuKQVvYv1Ensy04wHwYDVR0jBBgwFoAU7NfjgtJx",
  "XWRM3y5nP+e6mK4cD08wDgYDVR0PAQH/BAQDAgGGMBMGA1UdJQQMMAoGCCsGAQUFBwMIMHcGCCsGAQUFBwEBBGswaTAkBggrBgEFBQcwAYYYaHR0cDovL29j",
  "c3AuZGlnaWNlcnQuY29tMEEGCCsGAQUFBzAChjVodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGlnaUNlcnRUcnVzdGVkUm9vdEc0LmNydDBDBgNVHR8E",
  "PDA6MDigNqA0hjJodHRwOi8vY3JsMy5kaWdpY2VydC5jb20vRGlnaUNlcnRUcnVzdGVkUm9vdEc0LmNybDAgBgNVHSAEGTAXMAgGBmeBDAEEAjALBglghkgB",
  "hv1sBwEwDQYJKoZIhvcNAQELBQADggIBABfO+xaAHP4HPRF2cTC9vgvItTSmf83Qh8WIGjB/T8ObXAZz8OjuhUxjaaFdleMM0lBryPTQM2qEJPe36zwbSI/m",
  "S83afsl3YTj+IQhQE7jU/kXjjytJgnn0hvrV6hqWGd3rLAUt6vJy9lMDPjTLxLgXf9r5nWMQwr8Myb9rEVKChHyfpzee5kH0F8HABBgr0UdqirZ7bowe9Vj2",
  "AIMD8liyrukZ2iA/wdG2th9y1IsA0QF8dTXqvcnTmpfeQh35k5zOCPmSNq1UH410ANVko43+Cdmu4y81hjajV/gxdEkMx1NKU4uHQcKfZxAvBAKqMVuqte69",
  "M9J6A47OvgRaPs+2ykgcGV00TYr2Lr3ty9qIijanrUR3anzEwlvzZiiyfTPjLbnFRsjsYg39OlV8cipDoq7+qNNjqFzeGxcytL5TTLL4ZaoBdqbhOhZ3ZRDU",
  "phPvSRmMThi0vw9vODRzW6AxnJll38F0cuJG7uEBYTptMSbhdhGQDpOXgpIUsWTjd6xpR6oaQf/DJbg3s6KCLPAlZ66RzIg9sC+NJpud/v4+7RWsWCiKi9EO",
  "LLHfMR2ZyJ/+xhCx9yHbxtl5TPau1j/1MIDpMPx0LckTetiSuEtQvLsNz3Qbp7wGWqbIiOWCnb5WqxL3/BAPvIXKUjPSxyZsq8WhbaM2tszWkPZPubdcMIIF",
  "jTCCBHWgAwIBAgIQDpsYjvnQLefv21DiCEAYWjANBgkqhkiG9w0BAQwFADBlMQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQL",
  "ExB3d3cuZGlnaWNlcnQuY29tMSQwIgYDVQQDExtEaWdpQ2VydCBBc3N1cmVkIElEIFJvb3QgQ0EwHhcNMjIwODAxMDAwMDAwWhcNMzExMTA5MjM1OTU5WjBi",
  "MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3d3cuZGlnaWNlcnQuY29tMSEwHwYDVQQDExhEaWdpQ2VydCBUcnVzdGVk",
  "IFJvb3QgRzQwggIiMA0GCSqGSIb3DQEBAQUAA4ICDwAwggIKAoICAQC/5pBzaN675F1KPDAiMGkz7MKnJS7JIT3yithZwuEppz1Yq3aaza57G4QNxDAf8xuk",
  "OBbrVsaXbR2rsnnyyhHS5F/WBTxSD1Ifxp4VpX6+n6lXFllVcq9ok3DCsrp1mWpzMpTREEQQLt+C8weE5nQ7bXHiLQwb7iDVySAdYyktzuxeTsiT+CFhmzTr",
  "BcZe7FsavOvJz82sNEBfsXpm7nfISKhmV1efVFiODCu3T6cw2Vbuyntd463JT17lNecxy9qTXtyOj4DatpGYQJB5w3jHtrHEtWoYOAMQjdjUN6QuBX2I9YI+",
  "EJFwq1WCQTLX2wRzKm6RAXwhTNS8rhsDdV14Ztk6MUSaM0C/CNdaSaTC5qmgZ92kJ7yhTzm1EVgX9yRcRo9k98FpiHaYdj1ZXUJ2h4mXaXpI8OCiEhtmmnTK",
  "3kse5w5jrubU75KSOp493ADkRSWJtppEGSt+wJS00mFt6zPZxd9LBADMfRyVw4/3IbKyEbe7f/LVjHAsQWCqsWMYRJUadmJ+9oCw++hkpjPRiQfhvbfmQ6QY",
  "uKZ3AeEPlAwhHbJUKSWJbOUOUlFHdL4mrLZBdd56rF+NP8m800ERElvlEFDrMcXKchYiCd98THU/Y+whX8QgUWtvsauGi0/C1kVfnSD8oR7FwI+isX4KJpn1",
  "5GkvmB0t9dmpsh3lGwIDAQABo4IBOjCCATYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQU7NfjgtJxXWRM3y5nP+e6mK4cD08wHwYDVR0jBBgwFoAUReui",
  "r/SSy4IxLVGLp6chnfNtyA8wDgYDVR0PAQH/BAQDAgGGMHkGCCsGAQUFBwEBBG0wazAkBggrBgEFBQcwAYYYaHR0cDovL29jc3AuZGlnaWNlcnQuY29tMEMG",
  "CCsGAQUFBzAChjdodHRwOi8vY2FjZXJ0cy5kaWdpY2VydC5jb20vRGlnaUNlcnRBc3N1cmVkSURSb290Q0EuY3J0MEUGA1UdHwQ+MDwwOqA4oDaGNGh0dHA6",
  "Ly9jcmwzLmRpZ2ljZXJ0LmNvbS9EaWdpQ2VydEFzc3VyZWRJRFJvb3RDQS5jcmwwEQYDVR0gBAowCDAGBgRVHSAAMA0GCSqGSIb3DQEBDAUAA4IBAQBwoL9D",
  "XFXnOF+go3QbPbYW1/e/Vwe9mqyhhyzshV6pGrsi+IcaaVQi7aSId229GhT0E0p6Ly23OO/0/4C5+KH38nLeJLxSA8hO0Cre+i1Wz/n096wwepqLsl7Uz9FD",
  "RJtDIeuWcqFItJnLnU+nBgMTdydE1Od/6Fmo8L8vC6bp8jQ87PcDx4eo0kxAGTVGamlUsLihVo7spNU96LHc/RzY9HdaXFSMb++hUD38dglohJ9vytsgjTVg",
  "HAIDyyCwrFigDkBjxZgiwbJZ9VVrzyerbHbObyMt9H5xaiNrIv8SuFQtJ37YOtnwtoeW/VvRXKwYw02fc7cBqZ9Xql4o4rmUMYIDfDCCA3gCAQEwfTBpMQsw",
  "CQYDVQQGEwJVUzEXMBUGA1UEChMORGlnaUNlcnQsIEluYy4xQTA/BgNVBAMTOERpZ2lDZXJ0IFRydXN0ZWQgRzQgVGltZVN0YW1waW5nIFJTQTQwOTYgU0hB",
  "MjU2IDIwMjUgQ0ExAhAIT9wzT35FTtvDD4/5khg1MA0GCWCGSAFlAwQCAQUAoIHRMBoGCSqGSIb3DQEJAzENBgsqhkiG9w0BCRABBDAcBgkqhkiG9w0BCQUx",
  "DxcNMjYxMTE1MDIzNzQ1WjArBgsqhkiG9w0BCRACDDEcMBowGDAWBBRR2avaA0lz2E9CZqykgkjms2nEOTAvBgkqhkiG9w0BCQQxIgQg+YAVSPbwlo7nhnSh",
  "vjHE2pXKp0lceH88e2xqz7ewaaIwNwYLKoZIhvcNAQkQAi8xKDAmMCQwIgQgLaCdp/QTH5/nLbbF5unJZWdVrwQ/HqdCzA0hIOFB6/wwDQYJKoZIhvcNAQEB",
  "BQAEggIAVxo5d25NFdTZnL1P6fFSSkY6DJ3qCL0G0Q1pd1RNW3o19j2cBRoODJm95Y0Dq3TYy6TehbljxcJTpL5S/kuh8KDEm8vmpYcQUYV8ByAJSLtWyi3X",
  "2BxnUAi2itHs+oExUjOquwDqB0L+kFZ5GKnyG4c9CU/iCFn+ShYiG4KEcu5+NDIQbhBRX40yoeWnkvU6feyVsdFS4Xn34s7/r7vrN75MBdo2QjqHxAcdeP6l",
  "HbcMo1d7lRMFf3PxTvmyO+ZqQlnhVEQnq9cZQC4VRQ9LTWSaRmHUY0yrYaoqt31LBT+3glORzngaZb06M4ERqr2gBKgGO66DY8h4cYYkkbmQdMQOQr/7Msjp",
  "Z+hf7eF45D0M19kR3PEg3NhdbD33hz6Upxy5av2n9V7kFVK1FHmxbkyrsXnLG2B2vVeJ6M8fJOmwasSF8Koa2ZnKHyDocv03PobQ4etaCS2NYv2551N+zd5a",
  "ybz4VzIfBjLmVIgMgHhkHzyyELZCMLlXziRVpEbLW4F/2nk4eQ/z5olTIf5hPBCFe0tNMgzkGozY/rtsnbd9o6pQBfY5EpAnhslY4g1Ek/WRrirot7rSrwfu",
  "vs5dUn3t0KiFuQRiE8TTW123glLsI64V/gTIdP4dkqLJX39asc4zFJgAUCrZSa91fh1vpsgLN2S/HCj84ADstRmiNEk=",
].join("");
const DIGICERT_PROBE = { sha256Digest: "f1a460b977f44ec0e8936bfd20bf27a0e9ea33a394ddef59832f8fc9bcbf5d53", nonce: "15064536228734630695" };

export interface SelfTest { tsa: boolean; packet: boolean; signature: boolean }

export async function witnessSelfTest(trust: TsaTrust, signer: { publicKey: string; sign(text: string): Promise<string> }): Promise<SelfTest> {
  const result: SelfTest = { tsa: false, packet: false, signature: false };
  try {
    const stamp = verifyTimeStampToken(extractToken(Buffer.from(DIGICERT_PROBE_TSR, "base64")),
      { sha256Digest: Buffer.from(DIGICERT_PROBE.sha256Digest, "hex"), nonce: BigInt(DIGICERT_PROBE.nonce) }, trust);
    result.tsa = stamp.genTime === "20261115023745Z" && stamp.nonce === DIGICERT_PROBE.nonce;
  } catch { result.tsa = false; }
  try {
    const t = "2026-11-15T02:37:45.000000Z";
    const packet = { version: PACKET_VERSION, binding: { claimId: "self-test", policyId: "pregame-native-v1", codeVersion: "0".repeat(40), gameId: 1,
      slateDate: "2026-11-14", homeTeamId: 1, awayTeamId: 2, homeAbbrev: "AAA", awayAbbrev: "BBB", scheduledStart: t, calendarRevision: "0".repeat(64),
      inputCutoff: t }, readWindow: { start: t, end: t }, statedCutoff: "2026-11-15T02:37:50.000000Z", seasonBootstrapApplied: false,
      modelEnvironment: { "z": "1", "a": null }, candidates: { skaters: [3, 1, 2], goalies: [], reserves: [] },
      transport: { calls: 1, httpCalls: 1, rows: 1, bytes: 1, stampToleranceMs: 5000 },
      reads: [{ receivedAt: t, note: "é ✓ \u0000-free", nested: { b: 2, a: 1 } }] } as unknown as PregamePacket;
    const encoded = encodePacket(packet);
    const decoded = decodePacket(Uint8Array.from(encoded.bytes));
    result.packet = decoded.rawSha256 === encoded.rawSha256 && decoded.canonicalSha256 === encoded.canonicalSha256
      && decoded.rawSha256 === createHash("sha256").update(Uint8Array.from(encoded.bytes)).digest("hex");
  } catch { result.packet = false; }
  try {
    const text = "forge-witness-self-test";
    const signature = Uint8Array.from(atob(await signer.sign(text)), c => c.charCodeAt(0));
    const key = await globalThis.crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: signer.publicKey }, { name: "Ed25519" }, false, ["verify"]);
    const ok = await globalThis.crypto.subtle.verify({ name: "Ed25519" }, key, signature, new TextEncoder().encode(text));
    const forged = await globalThis.crypto.subtle.verify({ name: "Ed25519" }, key, signature, new TextEncoder().encode(text + "!"));
    result.signature = ok && !forged;
  } catch { result.signature = false; }
  return result;
}
