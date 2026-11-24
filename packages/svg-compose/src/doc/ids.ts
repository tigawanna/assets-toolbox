/** Stable, unique ids for every element in an imported tree. */

let counter = 0;

export const nextId = () => `n${++counter}`;

/**
 * Every element gets an id. Ids already present in the source are kept the
 * first time they are seen; later collisions (and missing ids) are replaced
 * with fresh generated ones that cannot collide with anything in the tree.
 */
/** Give a cloned subtree brand-new ids (used when duplicating objects). */
export function regenerateIds(root: ParentNode): void {
  for (const element of [root, ...Array.from(root.querySelectorAll("*"))]) {
    if (element instanceof Element) element.id = nextId();
  }
}

export function assignIds(root: ParentNode): void {
  const taken = new Set<string>();
  for (const element of Array.from(root.querySelectorAll("[id]"))) {
    if (element.id) taken.add(element.id);
  }

  const seen = new Set<string>();
  for (const element of Array.from(root.querySelectorAll("*"))) {
    const existing = element.id;
    if (existing && !seen.has(existing)) {
      seen.add(existing);
      continue;
    }
    let id = nextId();
    while (taken.has(id) || seen.has(id)) id = nextId();
    element.id = id;
    seen.add(id);
    taken.add(id);
  }
}
