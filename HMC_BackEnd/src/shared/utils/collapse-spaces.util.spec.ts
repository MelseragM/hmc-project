import { collapseSpaceRuns } from './collapse-spaces.util';

describe('collapseSpaceRuns', () => {
  it('collapses CHAR-padding runs inside notification rows', () => {
    expect(
      collapseSpaceRuns([
        {
          FROM_USER: '037400    - Amir Ibrahim',
          TO_USER: '037400    - Amir Ibrahim',
          SUBJECT:
            'Request for School Fee Reimbursement has been forwarded for approval to 030728    - Akram Gad',
        },
      ]),
    ).toEqual([
      {
        FROM_USER: '037400 - Amir Ibrahim',
        TO_USER: '037400 - Amir Ibrahim',
        SUBJECT:
          'Request for School Fee Reimbursement has been forwarded for approval to 030728 - Akram Gad',
      },
    ]);
  });

  it('trims leading/trailing padding', () => {
    expect(collapseSpaceRuns({ NAME: '  Amir Ibrahim   ' })).toEqual({ NAME: 'Amir Ibrahim' });
  });

  it('leaves non-strings, single spaces, tabs and newlines untouched', () => {
    expect(
      collapseSpaceRuns({
        NOTIFICATION_ID: 123861207,
        DUE_DATE: null,
        COMMENTS: 'line one\nline two\tend',
      }),
    ).toEqual({
      NOTIFICATION_ID: 123861207,
      DUE_DATE: null,
      COMMENTS: 'line one\nline two\tend',
    });
  });

  it('does not touch class instances such as Dates', () => {
    const when = new Date('2026-09-02T00:00:00Z');
    expect(collapseSpaceRuns({ SENT_DATE: when })).toEqual({ SENT_DATE: when });
  });
});
