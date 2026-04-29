def get_sort_assoc_from_order_query(order: str):
    sort_assoc = []
    for sort_pair in order.split(','):
        entry = sort_pair.split(':', maxsplit = 1)
        if len(entry) == 1:
            sort_assoc.append((entry[0].strip(), 'ASC'))
        elif len(entry) == 2:
            sort_assoc.append((entry[0].strip().lower(), entry[1].strip().upper()))
    return sort_assoc

def get_order_by_str(
        sort_assoc: list[tuple[str, str]] | None,
        valid_columns: list[str]
) -> str | None:
    if sort_assoc is None:
        return None
    order_columns = []
    for (sort_key, order) in sort_assoc:
        norm_order = 'DESC' if order.upper() == 'DESC' else 'ASC'
        norm_key = sort_key.lower() if sort_key.lower() in valid_columns else None
        if norm_key is not None:
            order_columns.append(f"{norm_key} {norm_order}")
    result = ', '.join(order_columns) if len(order_columns) > 0 else None
    return result
