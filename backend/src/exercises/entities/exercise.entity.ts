import { Exclude, Expose } from 'class-transformer';
import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/** Attribution of an exercise imported from an external provider (wger). */
export interface ExerciseSource {
  provider: string;
  externalId: number;
  sourceUrl: string | null;
  license: string | null;
  licenseUrl: string | null;
  author: string | null;
  importedAt: Date | null;
}

/** Exercises table (Lab 04): the exercise catalog managed by admins. */
@Entity({ name: 'Exercises' })
@Unique('UQ_Exercises_External', ['externalSource', 'externalId'])
export class Exercise {
  @PrimaryGeneratedColumn({ name: 'ExerciseID', type: 'int' })
  exerciseId: number;

  @Column({ name: 'ExerciseName', type: 'varchar', length: 100 })
  exerciseName: string;

  @Column({ name: 'Category', type: 'varchar', length: 100 })
  category: string;

  @Column({ name: 'Description', type: 'varchar', length: 255, nullable: true })
  description: string | null;

  // -------------------------------------------------------------------------
  // Extension columns (migration 001 — External Fitness API). All NULL for
  // local exercises. Hidden from JSON; exposed together as `source` below so
  // the original Lab 05 fields keep their exact shape.
  // -------------------------------------------------------------------------
  @Exclude()
  @Column({ name: 'ExternalSource', type: 'varchar', length: 20, nullable: true })
  externalSource: string | null;

  @Exclude()
  @Column({ name: 'ExternalID', type: 'int', nullable: true })
  externalId: number | null;

  @Exclude()
  @Column({ name: 'SourceUrl', type: 'varchar', length: 255, nullable: true })
  sourceUrl: string | null;

  @Exclude()
  @Column({ name: 'LicenseName', type: 'varchar', length: 100, nullable: true })
  licenseName: string | null;

  @Exclude()
  @Column({ name: 'LicenseUrl', type: 'varchar', length: 255, nullable: true })
  licenseUrl: string | null;

  @Exclude()
  @Column({ name: 'LicenseAuthor', type: 'varchar', length: 255, nullable: true })
  licenseAuthor: string | null;

  @Exclude()
  @Column({ name: 'ImportedAt', type: 'datetime', nullable: true })
  importedAt: Date | null;

  /** `null` for local exercises; attribution details for imported ones. */
  @Expose()
  get source(): ExerciseSource | null {
    if (!this.externalSource || this.externalId == null) return null;
    return {
      provider: this.externalSource,
      externalId: this.externalId,
      sourceUrl: this.sourceUrl ?? null,
      license: this.licenseName ?? null,
      licenseUrl: this.licenseUrl ?? null,
      author: this.licenseAuthor ?? null,
      importedAt: this.importedAt ?? null,
    };
  }
}
