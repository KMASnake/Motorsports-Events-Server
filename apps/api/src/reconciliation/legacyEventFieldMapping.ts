const legacyToLogical={
  name:'name',
  starts_at:'startsAt',
  ends_at:'endsAt',
  status:'status',
  session_title:'sessionLabel'
} as const;

export type LegacyReconcilableEventField=keyof typeof legacyToLogical;
export type LogicalLegacyEventField=typeof legacyToLogical[LegacyReconcilableEventField];

export function legacyEventFieldToReconciliationField(field:string):LogicalLegacyEventField|null{
  return Object.hasOwn(legacyToLogical,field)?legacyToLogical[field as LegacyReconcilableEventField]:null;
}

export const legacyReconcilableEventFieldEntries=Object.entries(legacyToLogical) as Array<[LegacyReconcilableEventField,LogicalLegacyEventField]>;
