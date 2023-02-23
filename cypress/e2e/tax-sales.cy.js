const jsonexport = require("jsonexport");
const fs = require("fs");

describe("Tax Sales Automation", () => {
  let counties;
  const auctions = {};
  //const obj = {};

  before(() => {
    cy.fixture("counties.json").then((data) => {
      counties = data;
    });
  });

  it("Get Auction Ids", () => {
    for (let county of counties) {
      auctions[county.name] = [];
      cy.visit(`https://www.bid4assets.com/storefront/${county.urlPath}`);
      cy.get("a.cc-dismiss").then(($a) => $a.click({ force: true }));
      cy.wait(2000);
      cy.get("#auction-folders-wp").click();
      cy.get("div.k-listview-content > div.bdgrey label.bsnone").each(
        ($folder) => {
          cy.wrap($folder).click();
          cy.wrap($folder)
            .invoke("attr", "for")
            .then((forAttribute) => {
              const auctionFolderId = forAttribute.split("-")[1];
              //console.log("auctionFolderId", auctionFolderId);
              cy.get(
                `#auctionGrid-${auctionFolderId} tr.k-master-row td:nth-child(2)`
              ).each(($el) => {
                //console.log("AuctionID", $el.text());
                auctions[county.name].push({ auctionId: $el.text() });
              });
            });
        }
      );
      cy.wait(20000);
      console.log("Auctions", county.name, auctions[county.name]);
    }

    //cy.visit(`https://www.bid4assets.com/storefront/MercedFeb23`);
  });

  it("Get Auction Details using ID's", () => {
    //console.log("Auctions Final", auctions);
    //cy.visit(`https://www.bid4assets.com/mvc/auction/1076099`);

    console.log("Total Auctions", auctions);
    for (let county in auctions) {
      console.log("Auctions per County", county, auctions[county]);
      for (let auction of auctions[county]) {
        console.log("Auction", auction);
        cy.visit(`https://www.bid4assets.com/mvc/auction/${auction.auctionId}`);
        let obj = auction;

        cy.elementExists("#auction-content h1").then((title) => {
          let auctionTitle = title.text().trim();
          obj.withdrawn = auctionTitle.includes("Withdrawn");
          obj.title = auctionTitle;
          obj.url = `<a target='_blank' href='https://www.bid4assets.com/mvc/auction/${auction.auctionId}'>Link</a>`;
          if (obj.withdrawn) {
            return;
          }

          //get location
          cy.elementExists(
            "div.auction-info-summary table tr:nth-child(3) td:nth-child(2)"
          ).then((location) => {
            if (location) {
              obj.location = location
                .html()
                .replace(/<br\s*\/?>/gi, " ")
                .replace(/[\n\t\r]/g, "")
                .replace(",", "")
                .trim();
            }
          });

          cy.elementExists("#current-bid-span").then((element) => {
            if (element) {
              obj["Current Bid"] = element.text().trim();
            }
          });

          cy.elementExists(".current-bid p > span").then((element) => {
            if (element) {
              obj["Bid Increment"] = element.text().trim();
            }
          });

          cy.elementExists("#num-bids-block").then((element) => {
            if (element) {
              obj["Number of Bids"] = element.text().trim();
            }
          });

          cy.elementExists(
            "div.auction-data-table table tr:nth-child(2) td"
          ).then((element) => {
            if (element) {
              obj["Minimum Bid"] = element.text().trim();
            }
          });

          cy.elementExists(
            "div.auction-data-table table tr:nth-child(6) td"
          ).then((element) => {
            if (element) {
              obj.status = element.text().trim();
            }
          });

          cy.elementExists(
            "div.auction-data-table table tr:nth-child(7) td"
          ).then((element) => {
            if (element) {
              obj["Auction Start DateTime"] = element.text().trim();
            }
          });

          cy.elementExists(
            "div.auction-data-table table tr:nth-child(8) td"
          ).then((element) => {
            if (element) {
              obj["Auction End DateTime"] = element.text().trim();
            }
          });

          cy.elementExists(
            "div.auction-data-table table tr:nth-child(11) td"
          ).then((element) => {
            if (element) {
              obj["Bid Deposit"] = element
                .text()
                .replace("— See Instructions", "")
                .trim();
            }
          });

          cy.get("div.item-specifics-table table").each((table) => {
            if (table) {
              cy.wrap(table)
                .find("tr:has(td)")
                .each((row) => {
                  cy.wrap(row)
                    .find("td:first")
                    .then((col) => {
                      const key = col["0"].innerText;
                      //console.log("key", key);
                      cy.wrap(row)
                        .find("td:last")
                        .then((col) => {
                          //console.log('html', col["0"]);
                          const value = col["0"].innerHTML
                            .replaceAll("<br>", " ")
                            //.replace(/,/g, '')
                            .replace(/(\r\n|\n|\r)/gm, "")
                            .replaceAll("<li>", "")
                            .replaceAll("</li>", "");
                          //console.log("val", value);
                          obj[key] = value;
                        });
                    });
                });
            }
          });
        });
      }
    }
  });

  it.skip("Get GIS Info", () => {
    for (let county in auctions) {
      auctions[county] = auctions[county].filter(
        (auction) => !auction.withdrawn
      );
      for (let auction of auctions[county]) {
        let modifiedAPNNumber = auction["APN"].replaceAll("-", "");
        cy.visit(`${county.webGIS}${modifiedAPNNumber}`);
        cy.wait(30000);
        cy.elementExists("button[title='OK']").then((okButton) => {
          okButton.click();
        });
        cy.wait(10000);
        cy.screenshot(`${county.name}\\${auction.auctionId}-1`);
        cy.wait(2000);
      }
    }

    // cy.elementExists("button.zoom-in").then((btn) => {
    //   btn.click();
    //   btn.click();
    // });
  });

  after(() => {
    console.log("Auctions Final", auctions);
    //console.log("Test Obj", obj);
    for (let county in auctions) {
      const activeAuctions = auctions[county].filter(
        (auction) => !auction.withdrawn
      );
      activeAuctions.forEach((auction) => {
        delete auction.withdrawn;
        auction.rating = "";
      });
      cy.writeFile(`results//${county}.json`, JSON.stringify(activeAuctions));
      jsonexport(activeAuctions, function (err, csv) {
        if (err) return console.error(err);
        cy.writeFile(`results//${county}.csv`, csv);
      });
    }
  });

  Cypress.on("uncaught:exception", (err, runnable) => {
    // returning false here prevents Cypress from
    // failing the test
    return false;
  });
});
