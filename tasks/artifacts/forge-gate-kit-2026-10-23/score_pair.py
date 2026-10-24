"""Paired offline report. Usage: score_pair.py OUT_DIR BASE CAND ACTUALS HITS_BLOCKS."""
import argparse
import score_gate as sg


def report(cohort):
    base, cand = cohort["variants"]
    print(f"# Paired gate: {cand} vs {base}\n")
    sg.checks_report(cohort)
    for group in ("all", "F", "D"):
        group_rows = [r for r in cohort["rows"] if group == "all" or r["pos"] == group]
        print(f"## {group}\n\n| head | paired n | bias base → candidate | rel. bias | RMSE | top decile [candidate CI] | Δbias CI | ΔRMSE CI |")
        print("|---|---|---|---|---|---|---|---|")
        for h in sg.HEADS:
            rows = sg.use(group_rows, h, [base, cand])
            a, c = sg.stats(rows, base, h), sg.stats(rows, cand, h)
            boot = sg.bootstrap(rows, h, base, cand)
            cells = [h, str(len(rows))]
            for key, spec in (("bias", "+.4f"), ("rel", "+.1%"), ("rmse", ".4f"), ("top", ".3f")):
                cells.append(f"{sg.fmt(a[key], spec)} → {sg.fmt(c[key], spec)}")
            cells[-1] += " " + sg.ci(boot["variants"][cand]["top"], ".3f")
            for key in ("delta_bias", "delta_rmse"):
                cells.append(sg.ci(boot[key], "+.4f"))
            print("| " + " | ".join(cells) + " |")
        print("\nForecast-binned deciles, own prediction, Σactual/Σpred:\n")
        print("| head | variant | " + " | ".join(f"d{i+1}" for i in range(10)) + " |")
        print("|---|---|" + "---|" * 10)
        for h in sg.HEADS:
            rows = sg.use(group_rows, h, [base, cand])
            for v in (base, cand):
                print(f"| {h} | {v} | " + " | ".join(sg.fmt(d["ratio"], ".2f") for d in sg.deciles(rows, v, h)) + " |")
        print()


def main(out_dir, base, cand, actuals_path, hb_path):
    report(sg.load_cohort(out_dir, base, cand, actuals_path, hb_path))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("out_dir", "base", "candidate", "actuals", "hits_blocks"):
        parser.add_argument(name)
    args = parser.parse_args()
    main(args.out_dir, args.base, args.candidate, args.actuals, args.hits_blocks)
