const { distanceMeters } = require("./geo");

describe("geo.distanceMeters", () => {
  it("returns 0 for the same point", () => {
    // Arrange
    const lat = 19.076;
    const lon = 72.8777;

    // Act
    const distance = distanceMeters(lat, lon, lat, lon);

    // Assert
    expect(distance).toBe(0);
  });

  it("measures one degree of latitude as about 111.2 km", () => {
    // Arrange / Act
    const distance = distanceMeters(0, 0, 1, 0);

    // Assert
    expect(distance).toBeGreaterThan(111150);
    expect(distance).toBeLessThan(111250);
  });

  it("measures London to Paris as about 343.6 km", () => {
    // Arrange
    const london = [51.5074, -0.1278];
    const paris = [48.8566, 2.3522];

    // Act
    const distance = distanceMeters(...london, ...paris);

    // Assert
    expect(distance / 1000).toBeCloseTo(343.6, 0);
  });

  it("is symmetric and accepts numeric strings from DECIMAL columns", () => {
    // Arrange / Act
    const forward = distanceMeters("19.0760000", "72.8777000", 18.5204, 73.8567);
    const back = distanceMeters(18.5204, 73.8567, 19.076, 72.8777);

    // Assert
    expect(forward).toBeCloseTo(back, 6);
    expect(forward / 1000).toBeCloseTo(119.9, 0);
  });

  it("handles antipodal points without NaN", () => {
    // Arrange / Act
    const distance = distanceMeters(0, 0, 0, 180);

    // Assert
    expect(distance / 1000).toBeCloseTo(20015.1, 0);
  });
});
