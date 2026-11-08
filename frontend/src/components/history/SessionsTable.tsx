import { Anchor, Paper, Table } from '@mantine/core';
import React, { memo } from 'react';
import { Link, useNavigate } from 'react-router';
import type { SessionRecord } from '../../types/api';
import { formatDateTime, formatDecimal, formatDuration } from '../../utils/formatters';

type Props = {
  sessions: SessionRecord[];
};

const SessionsTable: React.FC<Props> = ({ sessions }) => {
  const navigate = useNavigate();

  return (
    <Paper withBorder radius="md">
      <Table highlightOnHover verticalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Date and time</Table.Th>
            <Table.Th>Duration</Table.Th>
            <Table.Th>Average FPS</Table.Th>
            <Table.Th>% Good</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {sessions.map(({ id, started_at: startedAt, summary }) => (
            <Table.Tr
              key={id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/history/${id}`)}
            >
              <Table.Td>
                <Anchor component={Link} to={`/history/${id}`} size="sm">
                  {formatDateTime(startedAt)}
                </Anchor>
              </Table.Td>
              <Table.Td>{formatDuration(summary.duration_seconds)}</Table.Td>
              <Table.Td>{formatDecimal(summary.average_fps)}</Table.Td>
              <Table.Td>{formatDecimal(summary.good_percent, '%')}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
};

export default memo(SessionsTable);
