import { EntitySubscriberInterface, EventSubscriber, InsertEvent } from 'typeorm';

/**
 * Stores every @CreateDateColumn / @UpdateDateColumn as a real UTC instant.
 *
 * Why: the connection reads and writes DATETIME values as UTC (timezone 'Z'),
 * but a column filled by MySQL's DEFAULT CURRENT_TIMESTAMP gets the SERVER's
 * local time (Asia/Manila, UTC+8 on the development machine). Version 1 let
 * MariaDB fill CreatedAt / AssignedAt that way, so those values were shown
 * eight hours late. Setting the value from the application (unless the
 * caller already set one, e.g. the seed script's historical dates) makes
 * every stored instant UTC, independent of the database server's zone.
 */
// @EventSubscriber() is required: TypeORM only instantiates decorated subscriber classes.
@EventSubscriber()
export class UtcTimestampsSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<object>): void {
    const entity = event.entity as Record<string, unknown> | undefined;
    if (!entity) return;
    const now = new Date();
    for (const column of [event.metadata.createDateColumn, event.metadata.updateDateColumn]) {
      if (column && (column.getEntityValue(entity) === undefined || column.getEntityValue(entity) === null)) {
        column.setEntityValue(entity, now);
      }
    }
  }
}
