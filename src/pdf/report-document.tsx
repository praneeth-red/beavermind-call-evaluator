import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  type DocumentProps,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";

import type {
  DimensionResult,
  EvaluationResult,
  Evidence,
} from "../domain/types";

const colors = {
  paper: "#F3F6FA",
  sheet: "#FFFFFF",
  ink: "#142033",
  cobalt: "#3458E6",
  amber: "#C97918",
  red: "#B93843",
  graphite: "#5B6574",
  line: "#D8DEE8",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.paper,
    color: colors.ink,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.45,
    paddingBottom: 54,
    paddingHorizontal: 42,
    paddingTop: 42,
  },
  eyebrow: {
    color: colors.cobalt,
    fontSize: 7.5,
    fontWeight: 700,
    letterSpacing: 1.4,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  header: {
    borderBottomColor: colors.ink,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: -0.5,
  },
  score: {
    color: colors.cobalt,
    fontFamily: "Courier-Bold",
    fontSize: 34,
    lineHeight: 1,
    textAlign: "right",
  },
  scoreLabel: {
    color: colors.graphite,
    fontSize: 7.5,
    textAlign: "right",
  },
  grade: {
    color: colors.ink,
    fontFamily: "Courier-Bold",
    fontSize: 9,
    marginTop: 4,
    textAlign: "right",
  },
  oneThing: {
    backgroundColor: colors.sheet,
    borderLeftColor: colors.amber,
    borderLeftWidth: 4,
    marginTop: 20,
    padding: 16,
  },
  oneThingTitle: {
    fontSize: 17,
    fontWeight: 700,
    lineHeight: 1.2,
    marginBottom: 7,
  },
  projected: {
    color: colors.cobalt,
    fontFamily: "Courier-Bold",
    fontSize: 9,
    marginTop: 9,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
  },
  body: {
    color: colors.graphite,
  },
  redFlag: {
    backgroundColor: colors.sheet,
    borderLeftColor: colors.red,
    borderLeftWidth: 3,
    marginBottom: 8,
    padding: 11,
  },
  redFlagTitle: {
    color: colors.red,
    fontSize: 10.5,
    fontWeight: 700,
    marginBottom: 4,
  },
  dimensionsIntro: {
    borderBottomColor: colors.ink,
    borderBottomWidth: 1,
    marginTop: 23,
    paddingBottom: 9,
  },
  dimension: {
    backgroundColor: colors.sheet,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingBottom: 13,
    paddingHorizontal: 13,
    paddingTop: 13,
  },
  dimensionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 9,
  },
  dimensionIdentity: {
    flexDirection: "row",
    width: "82%",
  },
  dimensionNumber: {
    color: colors.cobalt,
    fontFamily: "Courier-Bold",
    fontSize: 8,
    marginRight: 10,
    width: 18,
  },
  dimensionName: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 2,
  },
  band: {
    color: colors.graphite,
    fontSize: 7.5,
  },
  dimensionScore: {
    color: colors.cobalt,
    fontFamily: "Courier-Bold",
    fontSize: 10,
    textAlign: "right",
  },
  detail: {
    marginTop: 8,
  },
  detailLabel: {
    color: colors.ink,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.8,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  evidence: {
    backgroundColor: colors.paper,
    borderLeftColor: colors.cobalt,
    borderLeftWidth: 2,
    marginBottom: 5,
    paddingBottom: 7,
    paddingHorizontal: 9,
    paddingTop: 7,
  },
  evidenceTurn: {
    color: colors.cobalt,
    fontFamily: "Courier-Bold",
    fontSize: 7.5,
    marginBottom: 3,
  },
  evidenceQuote: {
    color: colors.ink,
    fontFamily: "Courier",
    fontSize: 8.5,
    lineHeight: 1.4,
  },
  empty: {
    color: colors.graphite,
    fontSize: 8,
    fontStyle: "italic",
  },
  action: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    marginTop: 9,
    paddingTop: 8,
  },
  auditItem: {
    backgroundColor: colors.sheet,
    marginBottom: 6,
    padding: 9,
  },
  auditCode: {
    color: colors.cobalt,
    fontFamily: "Courier-Bold",
    fontSize: 8,
    marginBottom: 3,
  },
  assumption: {
    marginBottom: 5,
  },
  footer: {
    color: colors.graphite,
    fontFamily: "Courier",
    fontSize: 7.5,
    left: 42,
    position: "absolute",
    right: 42,
    textAlign: "right",
    top: 812,
    zIndex: 10,
  },
});

function EvidenceList({ evidence }: { evidence: Evidence[] }) {
  if (evidence.length === 0) {
    return <Text style={styles.empty}>No supporting turn was scored.</Text>;
  }

  return evidence.map((item, index) => (
    <View key={`${item.turn}-${index}`} style={styles.evidence} wrap>
      <Text style={styles.evidenceTurn} minPresenceAhead={28}>
        Turn {item.turn}
      </Text>
      <Text style={styles.evidenceQuote} orphans={2} widows={2}>
        &quot;{item.quote}&quot;
      </Text>
    </View>
  ));
}

function DetailText({
  body,
  label,
  action = false,
}: {
  body: string;
  label: string;
  action?: boolean;
}) {
  return (
    <Text
      style={action ? styles.action : styles.detail}
      minPresenceAhead={36}
      orphans={3}
      widows={2}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      {"\n"}
      <Text style={styles.body}>{body}</Text>
    </Text>
  );
}

function Dimension({ dimension }: { dimension: DimensionResult }) {
  return (
    <View style={styles.dimension} minPresenceAhead={100} wrap>
      <View style={styles.dimensionHeader}>
        <View style={styles.dimensionIdentity}>
          <Text style={styles.dimensionNumber}>
            {String(dimension.dimension).padStart(2, "0")}
          </Text>
          <View>
            <Text style={styles.dimensionName}>{dimension.name}</Text>
            <Text style={styles.band}>{dimension.band}</Text>
          </View>
        </View>
        <Text style={styles.dimensionScore}>
          {dimension.score === null ? "N/A" : dimension.score} / {dimension.maximum}
        </Text>
      </View>

      <DetailText label="Reasoning" body={dimension.reasoning} />
      <View style={styles.detail} wrap>
        <Text style={styles.detailLabel} minPresenceAhead={40}>
          Exact turn evidence
        </Text>
        <EvidenceList evidence={dimension.evidence} />
      </View>
      <DetailText
        action
        label="Missing behavior"
        body={dimension.missingBehavior}
      />
      <DetailText label="Quick fix" body={dimension.quickFix} />
    </View>
  );
}

export function ReportDocument({
  result,
}: {
  result: EvaluationResult;
}): ReactElement<DocumentProps> {
  return (
    <Document
      title="BeaverMind call evaluation"
      author="BeaverMind"
      subject="Evidence-based call evaluation"
      language="en"
    >
      <Page size="A4" style={styles.page} wrap>
        <Text
          fixed
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `BeaverMind call evaluation  |  Page ${pageNumber} of ${totalPages}`
          }
        />
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BeaverMind call evaluator</Text>
            <Text style={styles.title}>Call evaluation</Text>
          </View>
          <View>
            <Text style={styles.score}>{result.normalizedScore}</Text>
            <Text style={styles.scoreLabel}>out of 100</Text>
            <Text style={styles.grade}>{result.grade}</Text>
          </View>
        </View>

        <View style={styles.oneThing}>
          <Text style={styles.eyebrow}>One change</Text>
          <Text style={styles.oneThingTitle}>{result.oneThing.improvement}</Text>
          <Text style={styles.body}>{result.oneThing.explanation}</Text>
          <Text style={styles.projected}>
            Projected score: {result.oneThing.projectedScore}
          </Text>
        </View>

        <View style={styles.section} minPresenceAhead={80}>
          <Text style={styles.eyebrow}>Coach brief</Text>
          <Text style={styles.sectionTitle}>What the call shows</Text>
          <Text style={styles.body}>{result.brief}</Text>
        </View>

        <View style={styles.dimensionsIntro} minPresenceAhead={100}>
          <Text style={styles.eyebrow}>Evidence map</Text>
          <Text style={styles.sectionTitle}>Twelve scored dimensions</Text>
        </View>
        {result.dimensions.map((dimension) => (
          <Dimension key={dimension.dimension} dimension={dimension} />
        ))}

        <View style={styles.section} minPresenceAhead={100} wrap>
          <Text style={styles.eyebrow}>Score controls</Text>
          <Text style={styles.sectionTitle}>Applied caps</Text>
          {result.appliedDimensionCaps.length === 0 &&
          result.appliedTotalCaps.length === 0 ? (
            <Text style={styles.body}>No score caps were applied.</Text>
          ) : null}
          {result.appliedDimensionCaps.map((cap, index) => (
            <View key={`dimension-${cap.dimension}-${index}`} style={styles.auditItem} wrap>
              <Text style={styles.auditCode}>
                Dimension {cap.dimension}, maximum {cap.maximum}
              </Text>
              <Text style={styles.body}>{cap.reason}</Text>
            </View>
          ))}
          {result.appliedTotalCaps.map((cap, index) => (
            <View key={`total-${cap.maximum}-${index}`} style={styles.auditItem} wrap>
              <Text style={styles.auditCode}>Total maximum {cap.maximum}</Text>
              <Text style={styles.body}>{cap.reason}</Text>
            </View>
          ))}
        </View>

        <View break style={styles.section} wrap>
          <Text style={styles.eyebrow}>Audit notes</Text>
          <Text style={styles.sectionTitle}>Assumptions</Text>
          {result.assumptions.length === 0 ? (
            <Text style={styles.body}>No scoring assumptions were recorded.</Text>
          ) : (
            <View style={styles.auditItem} wrap>
              {result.assumptions.map((assumption, index) => (
                <Text key={index} style={styles.assumption}>
                  {assumption}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section} minPresenceAhead={90} wrap>
          <Text style={styles.eyebrow}>Retention watch</Text>
          <Text style={styles.sectionTitle}>Red flags</Text>
          {result.redFlags.length === 0 ? (
            <Text style={styles.body}>
              No evidence-backed retention risks were identified.
            </Text>
          ) : (
            result.redFlags.map((flag, index) => (
              <View key={`${flag.risk}-${index}`} style={styles.redFlag} wrap>
                <Text style={styles.redFlagTitle}>{flag.risk}</Text>
                <Text style={styles.body}>{flag.explanation}</Text>
                <View style={styles.detail} wrap>
                  <EvidenceList evidence={flag.evidence} />
                </View>
              </View>
            ))
          )}
        </View>

      </Page>
    </Document>
  );
}
