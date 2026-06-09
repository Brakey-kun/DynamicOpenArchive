import SemesterAdminClient from './SemesterAdminClient';

export async function generateStaticParams() {
  return [
    { id: '1' },
    { id: '2' },
    { id: '3' },
    { id: '4' },
    { id: '5' },
    { id: '6' },
    { id: 's7_bigdata_ai' },
    { id: 's7_cybersecurity' },
    { id: 's7_cloud' },
    { id: 's7_software' },
    { id: 's8_bigdata_ai' },
    { id: 's8_cybersecurity' },
    { id: 's8_cloud' },
    { id: 's8_software' },
    { id: 's9_bigdata_ai' },
    { id: 's9_cybersecurity' },
    { id: 's9_cloud' },
    { id: 's9_software' }
  ];
}

export default function Page({ params }: { params: { id: string } }) {
  return <SemesterAdminClient params={params} />;
}
