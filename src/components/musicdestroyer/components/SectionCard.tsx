"use client";

type Props = {
  title?: string;
  className?: string;
  children: React.ReactNode;
};

export default function SectionCard({ title, className, children }: Props) {
  return (
    <section className={`panel p-6 ${className ?? ''}`}>
      {title && <h3 className="grid-label mb-3">{title}</h3>}
      {children}
    </section>
  );
}