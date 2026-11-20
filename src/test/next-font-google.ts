type FontOptions = {
  variable?: string;
};

export function Inter(options: FontOptions = {}) {
  return {
    className: "test-inter-font",
    style: { fontFamily: "Inter" },
    variable: options.variable ?? "",
  };
}
