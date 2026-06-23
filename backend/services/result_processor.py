import random
from collections import Counter
from typing import List, Dict, Any

class ResultProcessor:
    FULL_THRESHOLD = 50
    SAMPLE_THRESHOLD = 500
    MAX_VALUE_LENGTH = 300

    def process(self, results: List[Dict], total_count: int, hint: str) -> Dict:
        if not results:
            return {
                "mode": "empty",
                "total_count": total_count,
                "message": "The query returned no results."
            }

        n = len(results)

        if hint == "aggregate_only" or total_count > self.SAMPLE_THRESHOLD:
            return {
                "mode": "aggregate_summary",
                "statistics": self._compute_stats(results),
                "total_count": total_count,
                "note": f"Query matched {total_count} records. Showing statistics only."
            }

        if n <= self.FULL_THRESHOLD:
            return {
                "mode": "full",
                "data": self._truncate(results),
                "row_count": n,
                "total_count": total_count
            }

        # Sample mode
        head = results[:5]
        tail = results[-5:]
        middle_pool = results[5:-5]
        middle_sample = random.sample(middle_pool, min(10, len(middle_pool)))
        sample = head + middle_sample + tail

        return {
            "mode": "sample",
            "sample_rows": self._truncate(sample),
            "statistics": self._compute_stats(results),
            "row_count": n,
            "total_count": total_count,
            "note": f"Showing {len(sample)} representative rows from {n} results."
        }

    def _compute_stats(self, results: List[Dict]) -> Dict:
        if not results:
            return {}
        stats = {}
        for key in results[0].keys():
            values = [r[key] for r in results if r.get(key) is not None]
            null_count = len(results) - len(values)
            if not values:
                stats[key] = {"null_count": null_count}
                continue
            if all(isinstance(v, (int, float)) for v in values):
                stats[key] = {
                    "min": min(values),
                    "max": max(values),
                    "avg": round(sum(values) / len(values), 3),
                    "sum": sum(values),
                    "null_count": null_count
                }
            else:
                counter = Counter(str(v)[:50] for v in values)
                stats[key] = {
                    "unique_count": len(counter),
                    "top_5": dict(counter.most_common(5)),
                    "null_count": null_count
                }
        return stats

    def _truncate(self, results: List[Dict]) -> List[Dict]:
        truncated = []
        for row in results:
            new_row = {}
            for k, v in row.items():
                if isinstance(v, str) and len(v) > self.MAX_VALUE_LENGTH:
                    new_row[k] = v[:self.MAX_VALUE_LENGTH] + "...[truncated]"
                else:
                    new_row[k] = v
            truncated.append(new_row)
        return truncated

result_processor = ResultProcessor()
