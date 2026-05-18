import PostEventWelcomeHub from "./PostEventWelcomeHub";
import SpeakerMaterialsSection from "./SpeakerMaterialsSection";

/** Post-conference attendee welcome + presentation column. */
export default function PostEventAttendeeLayout({
  firstName,
  evaluationComplete,
  presentationAccess,
  presentationItemCount,
  eventMediaState,
  onOpenPresentations,
  showPresentationHub,
  speakerMaterialsProps,
}) {
  return (
    <div
      className={`grid gap-6 lg:gap-8 ${
        showPresentationHub ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,400px)] lg:items-start" : ""
      }`}
    >
      <PostEventWelcomeHub
        firstName={firstName}
        evaluationComplete={evaluationComplete}
        presentationAccess={presentationAccess}
        presentationCount={presentationItemCount}
        eventMediaState={eventMediaState}
        onOpenPresentations={onOpenPresentations}
      />
      {showPresentationHub ? <SpeakerMaterialsSection embedded {...speakerMaterialsProps} /> : null}
    </div>
  );
}
