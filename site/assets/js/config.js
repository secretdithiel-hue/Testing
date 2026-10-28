/*
 * Website settings: the only file the team needs to edit.
 *
 * apiUrl: the Apps Script web app address that ends in /exec. In the spreadsheet open
 *   Admin Center -> Website & Online Forms; the address is shown there once the script
 *   is deployed (Extensions -> Apps Script -> Deploy -> New deployment -> Web app,
 *   Execute as: Me, Who has access: Anyone).
 *   While it is empty the website runs in PREVIEW mode: the forms can be tried out,
 *   but nothing is sent and every form says so.
 *
 * Opening and closing the forms, payment accounts and dates are NOT set here: they come
 * from the spreadsheet (Admin Center -> Website & Online Forms) so they change without
 * editing the website.
 */
window.HNS_CONFIG = {
  apiUrl: "",

  // The upcoming edition shown on the home page
  edition: {
    ordinal: "5th",
    theme: "",          // e.g. "…"; empty shows the competition's tagline instead
    year: ""
  },

  // Where people can reach the team
  contact: {
    participantsEmail: "husayngsoksayteam@gmail.com",
    partnersEmail: "husayngsoksay@gmail.com",
    facebookName: "Husay ng SokSay - UPLB Sociology Society",
    facebookUrl: "https://www.facebook.com/search/top?q=Husay%20ng%20SokSay%20-%20UPLB%20Sociology%20Society",
    instagram: "husayngsoksay"
  },

  // Optional: the registration Google Form, offered when online registration is not available.
  // Never put the Submission Form link here: it is only for registered participants.
  registrationGoogleForm: ""
};
