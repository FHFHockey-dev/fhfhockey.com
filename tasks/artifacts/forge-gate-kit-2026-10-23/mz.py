"""Offline actual-on-predicted OLS and D representation. Usage: mz.py OUT BASE,CAND ACTUALS HITS_BLOCKS."""
import argparse
import score_gate as sg


def main(out_dir, variants, actuals_path, hb_path):
    if len(variants) != 2:
        raise ValueError("provide exactly BASE,CAND to preserve paired denominators")
    cohort = sg.load_cohort(out_dir, *variants, actuals_path, hb_path)
    sg.checks_report(cohort)
    print("| head | paired n | " + " | ".join(f"MZ slope {v} (intercept)" for v in variants) + " |\n|---|---|" + "---|" * len(variants))
    for head in sg.HEADS:
        rows = sg.use(cohort["rows"], head, variants)
        cells = []
        for v in variants:
            values = sg.mz(rows, v, head)
            cells.append(f"{sg.fmt(values['slope'], '.3f')} ({sg.fmt(values['intercept'], '+.3f')})" +
                         (f"; {values['reason']}" if values["reason"] else ""))
        print(f"| {head} | {len(rows)} | " + " | ".join(cells) + " |")
    rows = sg.use(cohort["rows"], "FP", variants)
    print("\nD representation uses historical floor(n/10), descending FP; unknown positions remain explicit.")
    for variant in [*variants, None]:
        values = sg.defense_share(rows, variant)
        print(f"- {variant or 'actual'}: D in top FP decile {values['top_d']}/{values['top_n']}; "
              f"D all {values['all_d']}/{values['all_n']}; unknown {values['unknown_n']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("out_dir", "variants", "actuals", "hits_blocks"):
        parser.add_argument(name)
    args = parser.parse_args()
    main(args.out_dir, args.variants.split(","), args.actuals, args.hits_blocks)
