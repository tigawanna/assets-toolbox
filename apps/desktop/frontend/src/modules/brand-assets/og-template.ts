export const DEFAULT_OG_TEMPLATE = `export default function CustomOgImage(props) {
  const { title, description, siteLabel, iconDataUrl } = props;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        backgroundColor: '#121612',
        color: '#f3f1e9',
        fontFamily: 'Inter',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {iconDataUrl ? (
          <img src={iconDataUrl} width={56} height={56} alt="" />
        ) : null}
        <span style={{ fontSize: 22, fontWeight: 600, color: '#efa77f' }}>
          {siteLabel || 'PROJECT'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>{title}</div>
        {description ? (
          <div style={{ fontSize: 30, lineHeight: 1.35, color: '#b8bdb2' }}>{description}</div>
        ) : null}
      </div>
    </div>
  );
}
`;
