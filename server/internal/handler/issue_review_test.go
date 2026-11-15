package handler

import "testing"

// validateReviewVerdict guards the write-only reviewer-conclusion fields of an
// issue write (MUL-8620, AR-04). These cases pin the contract without a
// database: the three conclusions pass, anything else is refused, and the
// reason/note fields never travel without a verdict.
func TestValidateReviewVerdict(t *testing.T) {
	tests := []struct {
		name    string
		verdict string
		reasons string
		note    string
		wantErr bool
	}{
		{name: "ordinary write has no verdict fields", verdict: "", reasons: "", note: "", wantErr: false},
		{name: "pass", verdict: "pass", reasons: "", note: "", wantErr: false},
		{name: "reject with reasons", verdict: "reject", reasons: "quality_below_bar", note: "", wantErr: false},
		{
			name:    "conditional pass with conditions",
			verdict: "conditional_pass",
			reasons: "needs_human_check",
			note:    "Merge only after the migration is green",
			wantErr: false,
		},
		{name: "unknown verdict", verdict: "approve", reasons: "", note: "", wantErr: true},
		{name: "legacy approved spelling is refused", verdict: "approved", reasons: "", note: "", wantErr: true},
		{name: "reasons without a verdict", verdict: "", reasons: "quality_below_bar", note: "", wantErr: true},
		{name: "note without a verdict", verdict: "", reasons: "", note: "looks fine", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateReviewVerdict(tt.verdict, tt.reasons, tt.note)
			if (err != nil) != tt.wantErr {
				t.Fatalf("validateReviewVerdict(%q, %q, %q) error = %v, wantErr %v",
					tt.verdict, tt.reasons, tt.note, err, tt.wantErr)
			}
		})
	}
}
