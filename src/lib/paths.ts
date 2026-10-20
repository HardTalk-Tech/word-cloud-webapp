// Firestore / Storage paths, shared by the lite (phone) and full (screens, dashboard) SDKs.
export const paths = {
  attendees: (eventId: string) => `events/${eventId}/attendees`,
  attendee: (eventId: string, id: string) => `events/${eventId}/attendees/${id}`,
  responses: (eventId: string) => `events/${eventId}/responses`,
  response: (eventId: string, id: string) => `events/${eventId}/responses/${id}`,
  control: (eventId: string) => `events/${eventId}/control/state`,
  spotImage: (eventId: string, id: string) => `events/${eventId}/spot/${id}.jpg`,
  tileImage: (eventId: string, id: string) => `events/${eventId}/tile/${id}.jpg`,
  spotFolder: (eventId: string) => `events/${eventId}/spot`,
  tileFolder: (eventId: string) => `events/${eventId}/tile`,
};
