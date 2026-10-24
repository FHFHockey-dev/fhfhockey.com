"""Offline bias/top-decile CIs. Usage: gate_ci.py OUT_DIR BASE CAND ACTUALS HITS_BLOCKS.

The old external-scorer positional argument is replaced by explicit pair names.
"""
import argparse
import score_gate as sg


def main(out_dir, base, cand, actuals_path, hb_path):
    cohort = sg.load_cohort(out_dir, base, cand, actuals_path, hb_path)
    sg.checks_report(cohort)
    print("| head | variant | paired n | rel. bias [95% CI] | top decile [95% CI] |\n|---|---|---|---|---|")
    for h in ["FP", "HIT", "SOG", "BLK", "G", "A", "PPP"]:
        rows = sg.use(cohort["rows"], h, [base, cand])
        boot = sg.bootstrap(rows, h, base, cand)
        for v in (base, cand):
            values = sg.stats(rows, v, h)
            print(f"| {h} | {v} | {len(rows)} | {sg.fmt(values['rel'], '+.1%')} {sg.ci(boot['variants'][v]['rel'], '+.1%')} | "
                  f"{sg.fmt(values['top'], '.3f')} {sg.ci(boot['variants'][v]['top'], '.3f')} |")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("out_dir", "base", "candidate", "actuals", "hits_blocks"):
        parser.add_argument(name)
    args = parser.parse_args()
    main(args.out_dir, args.base, args.candidate, args.actuals, args.hits_blocks)
