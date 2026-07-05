/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { List } from 'react-window';

interface VirtualizedListProps {
  items: any[];
  renderItem: (item: any, index: number) => React.ReactNode;
  itemHeight?: number;
}

export function VirtualizedList({ items, renderItem, itemHeight = 120 }: VirtualizedListProps) {
  // Calculate viewport list height dynamically
  const listHeight = Math.max(200, window.innerHeight - 200);

  // Row renderer component
  const Row = React.useMemo(() => {
    return (props: { index: number; style: React.CSSProperties }) => {
      const { index, style } = props;
      const item = items[index];
      if (!item) return null;
      return (
        <div style={style} className="overflow-hidden">
          {renderItem(item, index)}
        </div>
      );
    };
  }, [items, renderItem]);

  return (
    <List<{}>
      rowCount={items.length}
      rowHeight={itemHeight}
      rowComponent={Row as any}
      style={{ height: listHeight, width: '100%', overflowX: 'hidden' }}
      rowProps={{}}
    />
  );
}
