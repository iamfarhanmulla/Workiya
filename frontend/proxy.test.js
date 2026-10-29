/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { config, proxy } from "./proxy";

function requestFor(path, withSession) {
  const headers = withSession ? { cookie: "wk_session=1" } : {};
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("proxy", () => {
  it("redirects dashboard routes to the login page without a session", () => {
    // Arrange
    const request = requestFor("/dashboard/companies", false);

    // Act
    const res = proxy(request);

    // Assert
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it.each(["/", "/login"])("redirects %s to the dashboard when a session exists", (path) => {
    // Arrange
    const request = requestFor(path, true);

    // Act
    const res = proxy(request);

    // Assert
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("lets dashboard requests through when a session exists", () => {
    // Arrange
    const request = requestFor("/dashboard", true);

    // Act
    const res = proxy(request);

    // Assert
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["/", "/login"])("lets %s through without a session", (path) => {
    // Arrange
    const request = requestFor(path, false);

    // Act
    const res = proxy(request);

    // Assert
    expect(res.headers.get("location")).toBeNull();
  });

  it("only matches the landing, login and dashboard routes", () => {
    // Arrange
    const expected = ["/", "/login", "/dashboard/:path*"];

    // Act
    const { matcher } = config;

    // Assert
    expect(matcher).toEqual(expected);
  });
});
